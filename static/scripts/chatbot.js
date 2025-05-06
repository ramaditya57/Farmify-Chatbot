document.addEventListener('DOMContentLoaded', function() {
    const chatContainer = document.getElementById('chatContainer');
    const historyContainer = document.getElementById('historyContainer');
    const questionInput = document.getElementById('questionInput');
    const askButton = document.getElementById('askButton');
    const newChatBtn = document.getElementById('newChatBtn');
    
    // Store all chat sessions
    let allSessions = [];
    
    // Get or create session ID
    let currentSessionId = '{{session_id}}';
    
    // Ask question when button is clicked
    askButton.addEventListener('click', askQuestion);
    
    // Or when Enter key is pressed
    questionInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            askQuestion();
        }
    });
    
    // Handle new chat button
    newChatBtn.addEventListener('click', startNewChat);
    
    // Load all sessions from server when page loads
    loadSessionsFromServer();
    
    function askQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;
        
        // Add user message to chat
        addMessageToChat('user', question);
        questionInput.value = '';
        
        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'bot-message p-3 mb-4 max-w-3xl typing-indicator';
        typingIndicator.textContent = 'Thinking';
        chatContainer.appendChild(typingIndicator);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Send question to server
        fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                session_id: currentSessionId
            }),
        })
        .then(response => response.json())
        .then(data => {
            // Remove typing indicator
            chatContainer.removeChild(typingIndicator);
            
            // Add bot response to chat
            if (data.error) {
                addMessageToChat('bot', `Error: ${data.error}`);
            } else {
                addMessageToChat('bot', data.answer);
                
                // Make sure this session is in our list
                if (!allSessions.includes(currentSessionId)) {
                    allSessions.push(currentSessionId);
                }
                
                // Update chat preview in history sidebar
                updateHistoryPreview(currentSessionId, question);
            }
        })
        .catch(error => {
            // Remove typing indicator
            chatContainer.removeChild(typingIndicator);
            addMessageToChat('bot', `Error: ${error.message}`);
        });
    }
    
    function addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = role === 'user' ? 'user-message p-3 mb-4 ml-auto max-w-3xl' : 'bot-message p-3 mb-4 max-w-3xl';
        
        // Handle multiline content
        content.split('\n').forEach(line => {
            if (line.trim() !== '') {
                const p = document.createElement('p');
                p.textContent = line;
                messageDiv.appendChild(p);
            }
        });
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    function startNewChat() {
        fetch('/new_chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            currentSessionId = data.session_id;
            
            // Add to our sessions list
            if (!allSessions.includes(currentSessionId)) {
                allSessions.push(currentSessionId);
            }
            
            // Update UI
            updateHistoryList();
            
            // Clear chat container
            chatContainer.innerHTML = '';
            addMessageToChat('bot', 'Hello! I\'m your Agricultural Disease Expert. How can I help you today?');
            
            // Add new chat to history sidebar with default text
            addChatToHistorySidebar(currentSessionId, 'New conversation');
        })
        .catch(error => {
            console.error('Error starting new chat:', error);
        });
    }
    
    function deleteChat(sessionId, event) {
        // Stop the click event from bubbling up to the parent
        event.stopPropagation();
        
        fetch('/delete_chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove session from our list
                allSessions = allSessions.filter(id => id !== sessionId);
                
                // Remove from sidebar
                const historyItem = document.querySelector(`.history-item[data-session-id="${sessionId}"]`);
                if (historyItem) {
                    historyContainer.removeChild(historyItem);
                }
                
                // If we deleted the current session, start a new one
                if (sessionId === currentSessionId) {
                    startNewChat();
                }
            }
        })
        .catch(error => {
            console.error('Error deleting chat:', error);
        });
    }
    
    function loadCurrentChat() {
        fetch('/get_history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: currentSessionId
            }),
        })
        .then(response => response.json())
        .then(data => {
            // Clear chat container first
            chatContainer.innerHTML = '';
            
            if (data.history && data.history.length > 0) {
                // Populate with history
                data.history.forEach(msg => {
                    addMessageToChat(msg.role === 'user' ? 'user' : 'bot', msg.content);
                });
                
                // Update preview in sidebar if this is an existing conversation
                const firstUserMsg = data.history.find(msg => msg.role === 'user');
                if (firstUserMsg) {
                    updateHistoryPreview(currentSessionId, firstUserMsg.content);
                }
            } else {
                // Add welcome message if no history
                addMessageToChat('bot', 'Hello! I\'m your Agricultural Disease Expert. How can I help you today?');
            }
        })
        .catch(error => {
            console.error('Error loading chat history:', error);
            addMessageToChat('bot', 'Hello! I\'m your Agricultural Disease Expert. How can I help you today?');
        });
    }
    
    function loadSessionsFromServer() {
        fetch('/get_all_sessions')
        .then(response => response.json())
        .then(data => {
            if (data.sessions && data.sessions.length > 0) {
                allSessions = data.sessions;
                updateHistoryList();
            } else {
                // If no sessions, make sure we have the current one
                allSessions = [currentSessionId];
                addChatToHistorySidebar(currentSessionId, 'New conversation');
            }
            
            // Load current chat content
            loadCurrentChat();
        })
        .catch(error => {
            console.error('Error loading sessions:', error);
            // Fall back to just the current session
            allSessions = [currentSessionId];
            addChatToHistorySidebar(currentSessionId, 'New conversation');
            loadCurrentChat();
        });
    }
    
    function updateHistoryList() {
        // Clear history container
        historyContainer.innerHTML = '';
        
        // Add history items for each session
        allSessions.forEach(sessionId => {
            addChatToHistorySidebar(sessionId, 'Loading...');
            
            // Load preview for this session
            fetch('/get_history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.history && data.history.length > 0) {
                    // Find first user message for preview
                    const firstUserMsg = data.history.find(msg => msg.role === 'user');
                    if (firstUserMsg) {
                        updateHistoryPreview(sessionId, firstUserMsg.content);
                    } else {
                        updateHistoryPreview(sessionId, 'New conversation');
                    }
                } else {
                    updateHistoryPreview(sessionId, 'New conversation');
                }
            })
            .catch(error => {
                console.error('Error loading history preview:', error);
                updateHistoryPreview(sessionId, 'Chat session');
            });
        });
    }
    
    function addChatToHistorySidebar(sessionId, previewText) {
        // Remove existing item if it exists
        const existingItem = document.querySelector(`.history-item[data-session-id="${sessionId}"]`);
        if (existingItem) {
            historyContainer.removeChild(existingItem);
        }
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item ' + (sessionId === currentSessionId ? 'active' : '');
        historyItem.dataset.sessionId = sessionId;
        
        // Create text element
        const textSpan = document.createElement('span');
        textSpan.className = 'history-text';
        textSpan.textContent = previewText.length > 30 ? 
            previewText.substring(0, 30) + '...' : 
            previewText;
        historyItem.appendChild(textSpan);
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn text-red-500 hover:text-red-700';
        deleteBtn.innerHTML = '×'; // Cross symbol
        deleteBtn.title = 'Delete conversation';
        deleteBtn.addEventListener('click', function(e) {
            deleteChat(sessionId, e);
        });
        historyItem.appendChild(deleteBtn);
        
        // Add click handler to the text part
        textSpan.addEventListener('click', function() {
            if (sessionId !== currentSessionId) {
                // Update current session
                currentSessionId = sessionId;
                
                // Update active state in sidebar
                document.querySelectorAll('.history-item').forEach(item => {
                    item.classList.remove('active');
                });
                historyItem.classList.add('active');
                
                // Load selected chat
                loadCurrentChat();
            }
        });
        
        // Add to container (prepend to show newest first)
        historyContainer.prepend(historyItem);
    }
    
    function updateHistoryPreview(sessionId, previewText) {
        addChatToHistorySidebar(sessionId, previewText);
    }
});