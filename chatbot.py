from flask import Flask, render_template, request, jsonify, session
import os
import uuid
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.chains import create_retrieval_chain, create_history_aware_retriever
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.messages import AIMessage, HumanMessage
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
import tempfile
import requests
import os.path

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))

# Set environment variables
os.environ["USER_AGENT"] = "AgricultureRAGChatbot/1.0 (LangChain)"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
load_dotenv()

# Define the path for persistent vector database
PERSIST_DIRECTORY = "./chroma_db"

def create_vectorstore():
    """Creates and returns a new vector store from the source documents"""
    print("Creating new vector store from source documents...")
    
    # Set up HuggingFace embeddings
    os.environ["HF_TOKEN"] = os.getenv("HF_TOKEN", "")
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L12-v2")
    
    # Define agricultural disease resources
    agricultural_resources = [
        "https://ipm.ucanr.edu/PMG/diseases/diseaseslist.html",
        "http://eos.com/blog/crop-diseases/"
    ]
    
    all_docs = []
    
    # Process HTML resources
    for url in agricultural_resources:
        try:
            loader = WebBaseLoader(web_path=url)
            docs = loader.load()
            all_docs.extend(docs)
            print(f"Loaded {len(docs)} documents from {url}")
        except Exception as e:
            print(f"Error loading {url}: {e}")
    
    # Process PDF resource
    pdf_url = "https://www.uky.edu/Ag/Entomology/PSEP/pdfs/11pests1disease.pdf"
    try:
        # Download PDF to a temporary file
        response = requests.get(pdf_url)
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
            temp_file.write(response.content)
            temp_path = temp_file.name
        
        # Load PDF content
        pdf_loader = PyPDFLoader(temp_path)
        pdf_docs = pdf_loader.load()
        all_docs.extend(pdf_docs)
        print(f"Loaded {len(pdf_docs)} pages from PDF")
        
        # Clean up temporary file
        os.unlink(temp_path)
    except Exception as e:
        print(f"Error loading PDF {pdf_url}: {e}")
    
    # Split documents and create vectorstore
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(all_docs)
    print(f"Created {len(splits)} text splits")
    
    # Create and persist the vector store
    vectorstore = Chroma.from_documents(
        documents=splits, 
        embedding=embeddings,
        persist_directory=PERSIST_DIRECTORY
    )
    
    return vectorstore

def load_vectorstore():
    """Loads an existing vector store from disk"""
    print("Loading existing vector store from disk...")
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L12-v2")
    return Chroma(persist_directory=PERSIST_DIRECTORY, embedding_function=embeddings)

def initialize_rag():
    """Initialize the RAG system with persistent vector store"""
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise ValueError("GROQ_API_KEY not found in environment variables")
    
    llm = ChatGroq(groq_api_key=groq_api_key, model_name="meta-llama/llama-4-scout-17b-16e-instruct")
    
    # Check if vector store exists, create it if not
    if os.path.exists(PERSIST_DIRECTORY) and os.path.isdir(PERSIST_DIRECTORY) and os.listdir(PERSIST_DIRECTORY):
        vectorstore = load_vectorstore()
    else:
        vectorstore = create_vectorstore()
    
    retriever = vectorstore.as_retriever()
    
    return setup_chain(llm, retriever)

def setup_chain(llm, retriever):
    # Updated system prompt to focus on agricultural diseases
    system_prompt = """
    You are an agricultural disease expert assistant. When answering questions, use the following 
    context about crop diseases, pests, and agricultural management techniques to provide
    accurate and helpful information:

    {context}
    
    Base your answers only on the information provided in the context. If you don't have enough
    information to answer the question, simply state that you don't have enough information
    rather than making up an answer.
    Also if out of context query like a casual greeting is asked then respond in kind using hip language.
    """

    contextualize_q_system_prompt = """
    Given a chat history and the latest user question about agricultural diseases or pests
    which might reference context in the chat history,
    formulate a standalone question which can be understood without the chat history.
    Do Not answer the question, just reformulate it if needed and otherwise return it as is
    """

    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])

    contextualize_q_prompt = ChatPromptTemplate.from_messages([
        ("system", contextualize_q_system_prompt),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])

    history_aware_retriever = create_history_aware_retriever(
        llm, retriever, contextualize_q_prompt
    )
    question_answer_chain = create_stuff_documents_chain(llm, qa_prompt)
    return create_retrieval_chain(history_aware_retriever, question_answer_chain)

# Initialize conversation storage
chat_histories = {}

def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in chat_histories:
        chat_histories[session_id] = ChatMessageHistory()
    return chat_histories[session_id]

# Initialize RAG chain once on startup
print("Initializing RAG system...")
rag_chain = initialize_rag()

# Create conversational RAG chain
conversational_rag_chain = RunnableWithMessageHistory(
    rag_chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="chat_history",
    output_messages_key="answer",
)

@app.route('/')
def home():
    # Generate a new session ID if one doesn't exist
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    return render_template('chatbot.html', session_id=session['session_id'])

@app.route('/ask', methods=['POST'])
def ask():
    try:
        question = request.json.get('question')
        session_id = request.json.get('session_id', session.get('session_id', str(uuid.uuid4())))
        
        if not question:
            return jsonify({'error': 'No question provided'}), 400
        
        # Handle greetings and general conversation
        greetings = ['hi', 'hello', 'hey', 'greetings']
        if question.lower().strip() in greetings:
            # Store the greeting and response in the chat history
            history = get_session_history(session_id)
            history.add_user_message(question)
            response_text = "Hello! I'm an agricultural disease expert assistant. How can I help you with information about crop diseases, pests, or agricultural management today?"
            history.add_ai_message(response_text)
            
            return jsonify({
                'answer': response_text,
                'session_id': session_id
            })
            
        response = conversational_rag_chain.invoke(
            {"input": question},
            config={"configurable": {"session_id": session_id}},
        )
        
        # Clean up the response if needed
        answer = response['answer']
        if isinstance(answer, dict):
            answer = answer.get('text', str(answer))
            
        return jsonify({
            'answer': answer,
            'session_id': session_id
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/new_chat', methods=['POST'])
def new_chat():
    # Generate a new session ID
    new_session_id = str(uuid.uuid4())
    session['session_id'] = new_session_id
    
    return jsonify({
        'success': True,
        'session_id': new_session_id,
        'message': 'New conversation started'
    })

@app.route('/delete_chat', methods=['POST'])
def delete_chat():
    session_id = request.json.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'No session ID provided'}), 400
    
    # Remove chat history for this session
    if session_id in chat_histories:
        del chat_histories[session_id]
        
    return jsonify({
        'success': True,
        'message': 'Conversation deleted'
    })

@app.route('/get_history', methods=['POST'])
def get_history():
    session_id = request.json.get('session_id', session.get('session_id'))
    
    if not session_id or session_id not in chat_histories:
        return jsonify({'history': []})
    
    history = chat_histories[session_id].messages
    formatted_history = []
    
    for msg in history:
        if isinstance(msg, HumanMessage):
            formatted_history.append({'role': 'user', 'content': msg.content})
        elif isinstance(msg, AIMessage):
            formatted_history.append({'role': 'assistant', 'content': msg.content})
    
    return jsonify({'history': formatted_history})

@app.route('/get_all_sessions', methods=['GET'])
def get_all_sessions():
    """Get a list of all available chat sessions"""
    return jsonify({
        'sessions': list(chat_histories.keys())
    })

if __name__ == '__main__':
    # app.run(debug=True)
    
    import os
    port = int(os.environ.get('PORT', 10000))  # Use environment variable if available
    app.run(host='0.0.0.0', port=port)