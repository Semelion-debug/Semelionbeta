let currentConversationId = null;
let conversations = {};
let userName = null;
let reasonActive = false;
let searchActive = false;
let currentCategoryFilter = 'all';
let currentSearchQuery = '';
let isOffline = false;
let offlineQueue = [];
let currentModel = 'SA Pro';
// Add these variables near the top with other state variables
let visionModeActive = false;
let currentVisionModel = 'SA Vision';

// Add this function for handling file input
function setupFileUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileUploadInput';
    fileInput.style.display = 'none';
    fileInput.accept = '.txt,.js,.py,.html,.css,.json,.md,.jpg,.jpeg,.png,.gif,.bmp,.webp';
    fileInput.multiple = true; // Allow multiple files
    
    document.body.appendChild(fileInput);
    
    // File input change handler
    fileInput.addEventListener('change', handleFileSelect);
    
    // Add file upload button to UI
    const fileUploadBtn = document.createElement('button');
    fileUploadBtn.className = 'action-btn';
    fileUploadBtn.id = 'fileUploadBtn';
    fileUploadBtn.type = 'button';
    fileUploadBtn.title = 'Upload files (text, code, images)';
    fileUploadBtn.innerHTML = '<i class="fas fa-paperclip"></i> Upload';
    
    // Insert after the search toggle button
    const searchToggle = document.getElementById('searchToggle');
    searchToggle.parentNode.insertBefore(fileUploadBtn, searchToggle.nextSibling);
    
    // Click handler for file upload button
    fileUploadBtn.onclick = () => {
        // Toggle vision mode when uploading images
        if (!visionModeActive) {
            toggleVisionMode();
        }
        fileInput.click();
    };
    
    // Add vision mode toggle button
    const visionToggleBtn = document.createElement('button');
    visionToggleBtn.className = 'action-btn';
    visionToggleBtn.id = 'visionToggle';
    visionToggleBtn.type = 'button';
    visionToggleBtn.title = 'Toggle Vision Mode (for image analysis)';
    visionToggleBtn.innerHTML = '<i class="fas fa-eye"></i> Vision';
    visionToggleBtn.style.display = 'none'; // Hidden by default
    
    // Insert after file upload button
    fileUploadBtn.parentNode.insertBefore(visionToggleBtn, fileUploadBtn.nextSibling);
    
    // Vision toggle handler
    visionToggleBtn.onclick = toggleVisionMode;
}

// Toggle vision mode
function toggleVisionMode() {
    visionModeActive = !visionModeActive;
    const visionBtn = document.getElementById('visionToggle');
    const modelSelector = document.getElementById('modelSelector');
    const fileUploadBtn = document.getElementById('fileUploadBtn');
    
    if (visionModeActive) {
        // Switch to vision model
        visionBtn.style.background = 'var(--bg-tertiary)';
        visionBtn.style.color = 'var(--text-primary)';
        visionBtn.innerHTML = '<i class="fas fa-eye"></i> Vision ✓';
        
        // Add vision model option
        if (!document.querySelector('option[value="SA Vision"]')) {
            const visionOption = document.createElement('option');
            visionOption.value = 'SA Vision';
            visionOption.textContent = 'SA Vision';
            modelSelector.appendChild(visionOption);
        }
        currentModel = 'SA Vision';
        modelSelector.value = 'SA Vision';
        
        // Update file upload button appearance
        fileUploadBtn.style.background = 'var(--accent)';
        fileUploadBtn.style.color = 'white';
        
        toast('Vision mode activated. Upload images for analysis.');
    } else {
        // Revert to normal mode
        visionBtn.style.background = 'transparent';
        visionBtn.style.color = 'var(--text-secondary)';
        visionBtn.innerHTML = '<i class="fas fa-eye"></i> Vision';
        
        // Remove vision model option and switch back to previous model
        const visionOption = document.querySelector('option[value="SA Vision"]');
        if (visionOption) {
            visionOption.remove();
        }
        currentModel = localStorage.getItem('semelion_model') || 'SA Pro';
        modelSelector.value = currentModel;
        
        // Update file upload button
        fileUploadBtn.style.background = 'transparent';
        fileUploadBtn.style.color = 'var(--text-secondary)';
        
        toast('Vision mode deactivated.');
    }
}

// Handle file selection
async function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Check file size and type
    const validFiles = files.filter(file => {
        const fileType = file.type;
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['txt', 'js', 'py', 'html', 'css', 'json', 'md', 
                                   'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        
        // Check extension
        if (!allowedExtensions.includes(fileExtension)) {
            toast(`File type ${fileExtension} not allowed`, false);
            return false;
        }
        
        // Check size (10MB max for images, 1MB for text files)
        const maxSize = fileType.startsWith('image/') ? 10 * 1024 * 1024 : 1 * 1024 * 1024;
        if (file.size > maxSize) {
            toast(`File ${file.name} is too large (max ${maxSize/1024/1024}MB)`, false);
            return false;
        }
        
        return true;
    });
    
    if (validFiles.length === 0) return;
    
    // Process each valid file
    for (const file of validFiles) {
        await processFile(file);
    }
    
    // Clear file input
    event.target.value = '';
}

// Process individual file
async function processFile(file) {
    const fileType = file.type;
    const fileName = file.name;
    
    try {
        if (fileType.startsWith('image/')) {
            // Handle image file
            await processImageFile(file);
        } else if (fileType.startsWith('text/') || 
                   ['.js', '.py', '.html', '.css', '.json', '.md'].includes('.' + fileName.split('.').pop())) {
            // Handle text/code file
            await processTextFile(file);
        }
    } catch (error) {
        console.error('Error processing file:', error);
        toast(`Error processing ${fileName}: ${error.message}`, false);
    }
}

// Process image file
async function processImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const base64Image = e.target.result;
                
                // Check if vision mode is active
                if (!visionModeActive) {
                    toggleVisionMode();
                }
                
                // Create a preview and add to chat
                const imgPreview = document.createElement('div');
                imgPreview.className = 'image-preview';
                imgPreview.innerHTML = `
                    <div class="image-preview-header">
                        <span><i class="fas fa-image"></i> ${file.name} (${(file.size/1024).toFixed(1)}KB)</span>
                        <button class="action-btn small" onclick="this.parentElement.parentElement.remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <img src="${base64Image}" alt="${file.name}" style="max-width: 300px; max-height: 200px; border-radius: 4px;">
                    <div class="image-preview-footer">
                        Ready for vision analysis
                    </div>
                `;
                
                // Add to message input
                const input = document.getElementById('messageInput');
                if (input.value.includes('[IMAGE ATTACHED]')) {
                    input.value = input.value.replace('[IMAGE ATTACHED]', `[IMAGE: ${file.name}] `);
                } else {
                    input.value = `[IMAGE: ${file.name}] ${input.value}`;
                }
                
                // Show preview in chat
                addImagePreview(file.name, base64Image, file.size);
                
                toast(`Image "${file.name}" uploaded for vision analysis`);
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
    });
}

// Process text/code file
async function processTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const textContent = e.target.result;
                
                // Check word count (120 words max)
                const wordCount = textContent.trim().split(/\s+/).length;
                if (wordCount > 120) {
                    toast(`File "${file.name}" has ${wordCount} words (max 120). Only first 120 words will be used.`, false);
                }
                
                // Truncate to 120 words if needed
                let processedText = textContent;
                if (wordCount > 120) {
                    const words = textContent.trim().split(/\s+/).slice(0, 120);
                    processedText = words.join(' ') + '... [truncated]';
                }
                
                // Add file content to message input
                const input = document.getElementById('messageInput');
                const fileExtension = file.name.split('.').pop().toLowerCase();
                const codeBlocks = ['js', 'py', 'html', 'css', 'json', 'md'];
                
                if (codeBlocks.includes(fileExtension)) {
                    input.value = `[CODE FILE: ${file.name}]\n\`\`\`${fileExtension}\n${processedText}\n\`\`\`\n${input.value}`;
                } else {
                    input.value = `[TEXT FILE: ${file.name}]\n${processedText}\n${input.value}`;
                }
                
                // Add preview
                addFilePreview(file.name, processedText, file.size, fileExtension);
                
                toast(`File "${file.name}" uploaded (${wordCount} words)`);
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
    });
}

// Add image preview to chat
function addImagePreview(fileName, base64Image, fileSize) {
    const chatMessages = document.getElementById('chatMessages');
    const previewDiv = document.createElement('div');
    previewDiv.className = 'message user file-preview';
    
    previewDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="message-content-wrapper">
            <div class="message-content">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <i class="fas fa-image" style="color: var(--accent);"></i>
                    <strong>${fileName}</strong>
                    <span style="font-size: 0.8em; color: var(--text-secondary);">
                        (${(fileSize/1024).toFixed(1)}KB)
                    </span>
                </div>
                <div style="text-align: center;">
                    <img src="${base64Image}" 
                         alt="${fileName}" 
                         style="max-width: 300px; max-height: 200px; border-radius: 8px; border: 1px solid var(--border);">
                </div>
                <div style="margin-top: 8px; font-size: 0.9em; color: var(--text-secondary);">
                    <i class="fas fa-info-circle"></i> Image ready for vision analysis
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(previewDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add file preview to chat
function addFilePreview(fileName, content, fileSize, extension) {
    const chatMessages = document.getElementById('chatMessages');
    const previewDiv = document.createElement('div');
    previewDiv.className = 'message user file-preview';
    
    const isCode = ['js', 'py', 'html', 'css', 'json', 'md'].includes(extension);
    const icon = isCode ? 'fa-code' : 'fa-file-alt';
    
    previewDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="message-content-wrapper">
            <div class="message-content">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <i class="fas ${icon}" style="color: var(--accent);"></i>
                    <strong>${fileName}</strong>
                    <span style="font-size: 0.8em; color: var(--text-secondary);">
                        (${(fileSize/1024).toFixed(1)}KB, ${extension.toUpperCase()})
                    </span>
                </div>
                <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border: 1px solid var(--border); max-height: 200px; overflow-y: auto;">
                    <pre style="margin: 0; font-size: 0.85em; white-space: pre-wrap;">${escapeHtml(content)}</pre>
                </div>
                <div style="margin-top: 8px; font-size: 0.9em; color: var(--text-secondary);">
                    <i class="fas fa-info-circle"></i> File content added to message
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(previewDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update the DOMContentLoaded event listener to include file upload setup
document.addEventListener('DOMContentLoaded', () => {
    loadConversations();
    startNewConversation();
    setupAutoResize();
    initUser();
    setupControls();
    setupKeyboardShortcuts();
    setupSearchAndFilter();
    setupConversationSearch();
    initTheme();
    setupOfflineMode();
    initModelSelector();
    setupFileUpload(); // Add this line
    loadSettings(); // Load settings on page initialization
});

/* ---------- send message logic ---------- */
async function sendMessage(overrideText = null, isRetry = false) {
    const input = document.getElementById('messageInput');
    let msg = overrideText;
    let hasFiles = false;
    let filePreviews = [];

    if (!isRetry) {
        msg = input.value.trim();
        filePreviews = document.querySelectorAll('.file-preview');
        hasFiles = filePreviews.length > 0;
        
        if (!msg && !hasFiles) return;
    
        input.value = '';
        input.style.height = 'auto';
    
        const idx = conversations[currentConversationId].messages.length;
        
        // Add message to chat (with file context if exists)
        let displayMsg = msg;
        if (hasFiles) {
            displayMsg = `[With ${filePreviews.length} attached file(s)] ${msg}`;
        }
        const timestamp = Date.now();
        appendMessageDOM(displayMsg, true, idx, null, timestamp);
        conversations[currentConversationId].messages.push({ 
            content: displayMsg, 
            isUser: true, 
            timestamp: timestamp,
            hasFiles: hasFiles
        });
        
        // Enforce memory limit
        enforceMemoryLimit();
        
        if (conversations[currentConversationId].messages.filter(m => m.isUser).length === 1) {
            conversations[currentConversationId].title = msg.slice(0, 30) + (msg.length > 30 ? '…' : '');
        }
        
        // Play notification sound
        playNotificationSound();
    }

    const thinkingEl = document.getElementById('thinkingDots');
    const labels = [];
    if (reasonActive) labels.push('REASONING');
    if (searchActive) labels.push('SEARCHING MAY TAKE 10SEC');
    if (visionModeActive) labels.push('VISION PROCESSING');
    
    thinkingEl.innerHTML = '<div class="thinking-animation"><i class="fas fa-spinner fa-spin"></i></div>' + 
                          (labels.length ? '<div class="thinking-labels">' + labels.join(' • ') + '</div>' : '');
    thinkingEl.style.display = 'block';
    document.getElementById('sendButton').disabled = true;

    // Check if offline
    if (isOffline) {
        addToOfflineQueue('message', msg || '');
        document.getElementById('thinkingDots').style.display = 'none';
        document.getElementById('sendButton').disabled = false;
        document.getElementById('messageInput').focus();
        return;
    }

    try {
        let finalMsg = msg || '';
        
        // Handle vision mode - extract image data from previews
        if (visionModeActive && !isRetry) {
            const imagePreviews = document.querySelectorAll('.image-preview img');
            if (imagePreviews.length > 0) {
                finalMsg += `\n\n[Analyze the attached image${imagePreviews.length > 1 ? 's' : ''}. I'll describe what I see.]`;
            }
        }
        
        if (searchActive) {
            const searchSummary = await performOnlineSearch(finalMsg);
            if (searchSummary) finalMsg += ` ${searchSummary}`;
        }
        
        // Get user system prompt if set
        const settings = JSON.parse(localStorage.getItem('semelion_settings') || '{}');
        const userSystemPrompt = settings.userSystemPrompt || '';
        
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: finalMsg, 
                conversation_history: conversations[currentConversationId].messages,
                user_name: userName || 'Anonymous',
                deep_thinking: reasonActive,
                online_search: searchActive,
                vision_mode: visionModeActive,
                model: currentModel,
                system_prompt: userSystemPrompt
            })
        });
        
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 429 && data.rate_limited) {
                appendMessageDOM('⏳ Limit reached. Try again in a minute.', false, conversations[currentConversationId].messages.length);
                startRateLimitCountdown(data.retry_after || 60);
                throw new Error('Rate limited');
            }
            throw new Error(data.error || 'Unknown error');
        }
        
        const botIdx = conversations[currentConversationId].messages.length;
        const reasoningProcess = data.reasoning_process || null;
        const timestamp = Date.now();
        appendMessageDOM(data.response, false, botIdx, reasoningProcess, timestamp);
        conversations[currentConversationId].messages.push({ 
            content: data.response, 
            isUser: false, 
            timestamp: timestamp,
            reasoningProcess: reasoningProcess
        });
        
        // Enforce memory limit
        enforceMemoryLimit();
        
        // Play notification sound and show desktop notification
        playNotificationSound();
        showDesktopNotification('Semelion AI', 'New response received');
        
        // Clear file previews after sending
        if (!isRetry) {
            document.querySelectorAll('.file-preview').forEach(preview => preview.remove());
        }
        
    } catch (err) {
        if (err.message !== 'Rate limited') {
            appendMessageDOM(`⚠️ ${err.message}`, false, conversations[currentConversationId].messages.length, null, Date.now());
        }
    } finally {
        document.getElementById('thinkingDots').style.display = 'none';
        document.getElementById('sendButton').disabled = false;
        document.getElementById('messageInput').focus();
        saveConversations();
        renderConversationsList();
        
        // Reset vision mode if active
        if (visionModeActive) {
            toggleVisionMode();
        }
    }
}

document.getElementById('chatForm').addEventListener('submit', async e => {
    e.preventDefault();
    await sendMessage();
});



/* ---------- utilities ---------- */
const generateConversationId = () =>
    'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
const saveConversations = () =>
    localStorage.setItem('rag_chatbot_conversations', JSON.stringify(conversations));
function loadConversations() {
    const saved = localStorage.getItem('rag_chatbot_conversations');
    if (saved) conversations = JSON.parse(saved);
}
function toast(msg, ok = true) {
    const n = document.createElement('div');
    n.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 18px;border-radius:8px;color:#fff;font-size:14px;background:${ok ? '#3fb950' : '#f85149'};z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:300px;word-wrap:break-word;`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

/* ---------- reasoning modal ---------- */
function showReasoningModal(reasoningText) {
    const modal = document.getElementById('reasoningModal');
    const content = document.getElementById('reasoningContent');
    content.innerHTML = formatMessage(reasoningText);
    modal.style.display = 'flex';
}

function closeReasoningModal() {
    document.getElementById('reasoningModal').style.display = 'none';
}



/* ---------- user/login ---------- */
function updateUserDisplay() {
    const display = document.getElementById('userDisplay');
    display.textContent = userName ? `Hi, ${userName}` : 'Not set';
}
async function loginWithName(name) {
    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        toast(data.message || 'Welcome');
        return data;
    } catch (e) {
        toast(e.message, false);
        throw e;
    }
}
function showSetNameModal() {
    const modal = document.getElementById('setNameModal');
    modal.style.display = 'flex';
    const input = document.getElementById('userNameInput');
    input.value = userName || '';
    input.focus();
}

function closeSetNameModal() {
    document.getElementById('setNameModal').style.display = 'none';
}

async function saveUserName() {
    const input = document.getElementById('userNameInput');
    const entered = input.value.trim();
    
    if (entered) {
        userName = entered;
        localStorage.setItem('semelion_user_name', userName);
        updateUserDisplay();
        closeSetNameModal();
        try {
            await loginWithName(userName);
        } catch (e) {
            console.error('Login error:', e);
        }
    } else {
        toast('Please enter a valid name', false);
    }
}

function initUser() {
    const savedName = localStorage.getItem('semelion_user_name');
    if (savedName) {
        userName = savedName;
        updateUserDisplay();
        loginWithName(userName).catch(() => {});
        return;
    }
    // Instead of prompt, show modal if user hasn't set name
    // We can choose to show it automatically or wait for user action.
    // Let's show it automatically for first time users
    setTimeout(showSetNameModal, 1000);
}

function setupControls() {
    document.getElementById('setNameBtn').onclick = () => {
        showSetNameModal();
    };
    const reasonBtn = document.getElementById('reasonToggle');
    reasonBtn.onclick = () => {
        reasonActive = !reasonActive;
        reasonBtn.style.background = reasonActive ? 'var(--bg-tertiary)' : 'transparent';
        reasonBtn.style.color = reasonActive ? 'var(--text-primary)' : 'var(--text-secondary)';
    };
    const searchBtn = document.getElementById('searchToggle');
    searchBtn.onclick = () => {
        searchActive = !searchActive;
        searchBtn.style.background = searchActive ? 'var(--bg-tertiary)' : 'transparent';
        searchBtn.style.color = searchActive ? 'var(--text-primary)' : 'var(--text-secondary)';
    };
    document.getElementById('rememberBtn').onclick = async () => {
        const input = document.getElementById('messageInput');
        const text = (input.value || '').trim() || (conversations[currentConversationId].messages.at(-1)?.content || '').trim();
        if (!userName) { 
            toast('Please set your name first', false); 
            return; 
        }
        if (!text) { 
            toast('Nothing to remember - enter text or select a message', false); 
            return; 
        }
        
        // Show loading state
        const btn = document.getElementById('rememberBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
        
        try {
            const res = await fetch('/add_favorite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: userName, item: text })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            toast('✅ Saved to your favorites!');
        } catch (e) {
            toast(`❌ ${e.message}`, false);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
}

/* ---------- keyboard shortcuts ---------- */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K: Focus input
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('messageInput').focus();
        }
        
        // Ctrl/Cmd + N: New conversation
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            startNewConversation();
        }
        
        // Ctrl/Cmd + /: Toggle sidebar
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            toggleSidebar();
        }
        
        // Escape: Close sidebar or modals
        if (e.key === 'Escape') {
            closeSidebar();
            closeReasoningModal();
        }
    });
}

/* ---------- model selector ---------- */
function initModelSelector() {
    const savedModel = localStorage.getItem('semelion_model') || 'SA Pro';
    currentModel = savedModel;
    
    const modelSelector = document.getElementById('modelSelector');
    if (modelSelector) {
        modelSelector.value = currentModel;
        modelSelector.addEventListener('change', (e) => {
            currentModel = e.target.value;
            localStorage.setItem('semelion_model', currentModel);
            toast(`Switched to ${currentModel}`);
        });
    }
}

/* ---------- theme management ---------- */
function initTheme() {
    const savedTheme = localStorage.getItem('semelion_theme') || 'dark';
    setTheme(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('semelion_theme', newTheme);
    toast(`Switched to ${newTheme} theme`);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        const icon = themeBtn.querySelector('i');
        icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

/* ---------- settings management ---------- */
function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'flex';
    loadSettings();
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('semelion_settings') || '{}');
    
    // Load theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    document.getElementById('themeSelect').value = currentTheme;
    
    // Load appearance settings
    document.getElementById('fontSize').value = settings.fontSize || 'medium';
    document.getElementById('compactMode').checked = settings.compactMode || false;
    
    // Load conversation settings
    document.getElementById('autoSave').checked = settings.autoSave !== false;
    document.getElementById('showTimestamps').checked = settings.showTimestamps !== false;
    document.getElementById('memoryLimit').value = settings.memoryLimit || '50';
    
    // Load AI behavior settings
    document.getElementById('defaultReasoning').checked = settings.defaultReasoning || false;
    document.getElementById('defaultSearch').checked = settings.defaultSearch || false;
    document.getElementById('userSystemPrompt').value = settings.userSystemPrompt || '';
    
    // Load notification settings
    document.getElementById('soundNotifications').checked = settings.soundNotifications || false;
    document.getElementById('desktopNotifications').checked = settings.desktopNotifications || false;
    
    // Load export settings
    document.getElementById('exportTimestamps').checked = settings.exportTimestamps !== false;
    document.getElementById('exportReasoning').checked = settings.exportReasoning !== false;
    
    // Apply appearance settings
    applyAppearanceSettings(settings);
    
    // Apply AI behavior settings to UI
    if (settings.defaultReasoning) {
        reasonActive = true;
        document.getElementById('reasonToggle')?.classList.add('active');
    }
    if (settings.defaultSearch) {
        searchActive = true;
        document.getElementById('searchToggle')?.classList.add('active');
    }
}

function changeTheme(theme) {
    setTheme(theme);
    localStorage.setItem('semelion_theme', theme);
    saveSettings();
}

function saveSettings() {
    const settings = {
        autoSave: document.getElementById('autoSave').checked,
        showTimestamps: document.getElementById('showTimestamps').checked,
        defaultReasoning: document.getElementById('defaultReasoning').checked,
        defaultSearch: document.getElementById('defaultSearch').checked,
        userSystemPrompt: document.getElementById('userSystemPrompt').value.trim(),
        fontSize: document.getElementById('fontSize').value,
        compactMode: document.getElementById('compactMode').checked,
        memoryLimit: document.getElementById('memoryLimit').value,
        soundNotifications: document.getElementById('soundNotifications').checked,
        desktopNotifications: document.getElementById('desktopNotifications').checked,
        exportTimestamps: document.getElementById('exportTimestamps').checked,
        exportReasoning: document.getElementById('exportReasoning').checked
    };
    localStorage.setItem('semelion_settings', JSON.stringify(settings));
    
    // Apply appearance settings
    applyAppearanceSettings(settings);
    
    // Apply AI behavior changes immediately
    if (settings.defaultReasoning) {
        reasonActive = true;
        document.getElementById('reasonToggle')?.classList.add('active');
    } else {
        reasonActive = false;
        document.getElementById('reasonToggle')?.classList.remove('active');
    }
    
    if (settings.defaultSearch) {
        searchActive = true;
        document.getElementById('searchToggle')?.classList.add('active');
    } else {
        searchActive = false;
        document.getElementById('searchToggle')?.classList.remove('active');
    }
    
    // Request desktop notification permission if enabled
    if (settings.desktopNotifications && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    toast('Settings saved');
}

function clearAllData() {
    if (!confirm('This will delete all conversations and settings. Are you sure?')) return;
    
    localStorage.clear();
    conversations = {};
    currentConversationId = null;
    userName = null;
    
    // Reset UI
    startNewConversation();
    initUser();
    initTheme();
    loadSettings();
    
    toast('All data cleared');
    closeSettings();
}

function resetSystemPrompt() {
    document.getElementById('userSystemPrompt').value = '';
    saveSettings();
    toast('System prompt reset to default');
}

function applyAppearanceSettings(settings) {
    // Apply font size
    const fontSize = settings.fontSize || 'medium';
    document.documentElement.setAttribute('data-font-size', fontSize);
    
    // Apply compact mode
    const compactMode = settings.compactMode || false;
    document.body.classList.toggle('compact-mode', compactMode);
}

function exportConversations(format = 'json') {
    const settings = JSON.parse(localStorage.getItem('semelion_settings') || '{}');
    const includeTimestamps = settings.exportTimestamps !== false;
    const includeReasoning = settings.exportReasoning !== false;
    
    if (format === 'txt') {
        // Export as plain text
        let text = `Semelion AI Conversation Export\n`;
        text += `Export Date: ${new Date().toISOString()}\n`;
        text += `=====================================\n\n`;
        
        Object.values(conversations).forEach(conv => {
            text += `Conversation: ${conv.title || 'Untitled'}\n`;
            text += `Messages: ${conv.messages.length}\n`;
            text += `-------------------------------------\n`;
            
            conv.messages.forEach(msg => {
                const role = msg.isUser ? 'You' : 'AI';
                let content = msg.content;
                
                if (includeTimestamps && msg.timestamp) {
                    const date = new Date(msg.timestamp);
                    content = `[${date.toLocaleString()}] ${content}`;
                }
                
                if (includeReasoning && msg.reasoningProcess) {
                    content += `\n[Reasoning: ${msg.reasoningProcess}]`;
                }
                
                text += `${role}: ${content}\n\n`;
            });
            
            text += `=====================================\n\n`;
        });
        
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `semelion-conversations-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } else {
        // Export as JSON (default)
        const data = {
            conversations: conversations,
            settings: settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `semelion-conversations-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    toast('Conversations exported successfully');
}

function importConversations() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate the data structure
                if (!data.conversations || typeof data.conversations !== 'object') {
                    throw new Error('Invalid format: conversations object not found');
                }
                
                const conversationCount = Object.keys(data.conversations).length;
                if (conversationCount === 0) {
                    throw new Error('No conversations found in file');
                }
                
                // Validate each conversation
                Object.entries(data.conversations).forEach(([convId, conv]) => {
                    if (!conv.messages || !Array.isArray(conv.messages)) {
                        throw new Error(`Invalid conversation ${convId}: messages array not found`);
                    }
                    if (!conv.title || typeof conv.title !== 'string') {
                        throw new Error(`Invalid conversation ${convId}: title not found`);
                    }
                });
                
                if (confirm(`Import ${conversationCount} conversations? This will merge with existing conversations.`)) {
                    let importedCount = 0;
                    let skippedCount = 0;
                    
                    // Merge conversations
                    Object.entries(data.conversations).forEach(([convId, conv]) => {
                        if (!conversations[convId]) {
                            // Ensure conversation has all required fields
                            conversations[convId] = {
                                id: convId,
                                title: conv.title || 'Imported conversation',
                                messages: conv.messages || [],
                                timestamp: conv.timestamp || Date.now(),
                                category: conv.category || 'general'
                            };
                            importedCount++;
                        } else {
                            skippedCount++;
                        }
                    });
                    
                    // Save to localStorage
                    saveConversations();
                    
                    // Refresh UI
                    renderConversationsList();
                    
                    toast(`Imported ${importedCount} conversations${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`);
                    
                    // Log success for debugging
                    console.log('Import successful:', {
                        imported: importedCount,
                        skipped: skippedCount,
                        totalInFile: conversationCount,
                        totalNow: Object.keys(conversations).length
                    });
                    
                    // Debug: Check imported conversation structure
                    if (importedCount > 0) {
                        console.log('=== IMPORTED CONVERSATION DEBUG ===');
                        Object.entries(conversations).slice(-importedCount).forEach(([id, conv]) => {
                            console.log(`\nImported conversation: ${id}`);
                            console.log(`Title: ${conv.title}`);
                            console.log(`Messages count: ${conv.messages.length}`);
                            if (conv.messages.length > 0) {
                                console.log(`First message:`, conv.messages[0]);
                                console.log(`Message has content: ${'content' in conv.messages[0]}`);
                                console.log(`Message has isUser: ${'isUser' in conv.messages[0]}`);
                                console.log(`Message has timestamp: ${'timestamp' in conv.messages[0]}`);
                            }
                        });
                        console.log('=== END DEBUG ===');
                        
                        // Test loading the first imported conversation
                        const firstImportedId = Object.keys(conversations).slice(-importedCount)[0];
                        console.log(`Testing load of conversation: ${firstImportedId}`);
                        setTimeout(() => {
                            loadConversation(firstImportedId);
                        }, 1000);
                    }
                }
            } catch (err) {
                console.error('Import error:', err);
                toast(`Error importing conversations: ${err.message}`);
            }
        };
        reader.onerror = function() {
            toast('Error reading file');
        };
        reader.readAsText(file);
    };
    input.click();
}

function playNotificationSound() {
    const settings = JSON.parse(localStorage.getItem('semelion_settings') || '{}');
    if (settings.soundNotifications) {
        // Create a simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }
}

function showDesktopNotification(title, body) {
    const settings = JSON.parse(localStorage.getItem('semelion_settings') || '{}');
    if (settings.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/static/ico.png',
            tag: 'semelion-notification'
        });
    }
}

function enforceMemoryLimit() {
    const settings = JSON.parse(localStorage.getItem('semelion_settings') || '{}');
    const memoryLimit = settings.memoryLimit || '50';
    
    if (memoryLimit === 'unlimited') return;
    
    const limit = parseInt(memoryLimit);
    const messages = conversations[currentConversationId].messages;
    
    if (messages.length > limit) {
        // Keep the most recent messages
        const excess = messages.length - limit;
        conversations[currentConversationId].messages = messages.slice(excess);
        
        // Refresh the chat display
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = '';
        conversations[currentConversationId].messages.forEach((msg, index) => {
            appendMessageDOM(msg.content, msg.isUser, index, msg.reasoningProcess, msg.timestamp);
        });
    }
}

/* ---------- conversation search ---------- */
function setupConversationSearch() {
    const searchInput = document.getElementById('searchConversations');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        filterConversations(query);
    });
    
    // Clear search on escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.target.value = '';
            filterConversations('');
        }
    });
}

function filterConversations(query) {
    const list = document.getElementById('conversationsList');
    const conversationItems = list.querySelectorAll('.conversation-item');
    
    if (!query) {
        // Show all conversations
        conversationItems.forEach(item => {
            item.style.display = 'block';
        });
        return;
    }
    
    // Filter conversations
    conversationItems.forEach(item => {
        const title = item.querySelector('.conversation-title')?.textContent.toLowerCase() || '';
        const preview = item.querySelector('.conversation-preview')?.textContent.toLowerCase() || '';
        
        if (title.includes(query) || preview.includes(query)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

/* ---------- sidebar ---------- */
function toggleSidebar() {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebarOverlay');
    s.classList.toggle('open');
    o.classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

/* ---------- conversation handling ---------- */
function startNewConversation() {
    currentConversationId = generateConversationId();
    conversations[currentConversationId] = {
        id: currentConversationId,
        title: 'New conversation',
        messages: [],
        timestamp: Date.now(),
        category: 'general'
    };
    renderConversationsList();
    clearChatWindow();
    document.getElementById('messageInput').focus();
    closeSidebar();
}

function loadConversation(id) {
    currentConversationId = id;
    renderConversationsList();
    clearChatWindow();
    conversations[id].messages.forEach((m, i) => appendMessageDOM(m.content, m.isUser, i, m.reasoningProcess, m.timestamp));
    document.getElementById('messageInput').focus();
    closeSidebar();
}

function deleteConversation(id, e) {
    e.stopPropagation();
    if (!confirm('Delete conversation?')) return;
    delete conversations[id];
    if (currentConversationId === id) startNewConversation();
    else { saveConversations(); renderConversationsList(); }
}

function shareConversation(id, e) {
    e.stopPropagation();
    const conversation = conversations[id];
    if (!conversation) return;
    
    // Create shareable text
    const shareText = `Semelion AI Conversation: ${conversation.title}\n\n` +
        conversation.messages.map(msg => 
            `${msg.isUser ? 'User' : 'Semelion AI'}: ${msg.content}`
        ).join('\n\n') +
        `\n\nShared from Semelion AI - Created in Malawi`;
    
    // Try to use Web Share API if available
    if (navigator.share) {
        navigator.share({
            title: `Semelion AI: ${conversation.title}`,
            text: shareText
        }).catch(() => {
            fallbackShare(shareText);
        });
    } else {
        fallbackShare(shareText);
    }
}

function fallbackShare(text) {
    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        toast('✅ Conversation copied to clipboard!');
    }).catch(() => {
        // Fallback: show in modal
        showShareModal(text);
    });
}

function showShareModal(text) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Share Conversation</h3>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <textarea readonly style="width: 100%; height: 300px; resize: vertical; font-family: monospace; font-size: 12px;">${text}</textarea>
                <div style="margin-top: 12px; text-align: center;">
                    <button class="action-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(() => toast('Copied!')).catch(() => {}); this.closest('.modal').remove();">
                        <i class="fas fa-copy"></i> Copy to Clipboard
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function renderConversationsList() {
    const list = document.getElementById('conversationsList');
    list.innerHTML = '';
    
    let filteredConversations = Object.values(conversations);
    
    // Filter by category
    if (currentCategoryFilter !== 'all') {
        filteredConversations = filteredConversations.filter(c => c.category === currentCategoryFilter);
    }
    
    // Filter by search query
    if (currentSearchQuery) {
        const query = currentSearchQuery.toLowerCase();
        filteredConversations = filteredConversations.filter(c => 
            c.title.toLowerCase().includes(query) ||
            c.messages.some(m => m.content.toLowerCase().includes(query))
        );
    }
    
    const sortedConversations = filteredConversations.sort((a, b) => b.timestamp - a.timestamp);
    
    if (sortedConversations.length === 0) {
        const message = currentSearchQuery || currentCategoryFilter !== 'all' 
            ? 'No conversations found' 
            : 'No conversations yet';
        list.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 14px;">${message}</div>`;
        return;
    }
    
    sortedConversations.forEach(c => {
        const div = document.createElement('div');
        div.className = 'conversation-item' + (c.id === currentConversationId ? ' active' : '');
        div.onclick = () => loadConversation(c.id);
        
        const last = c.messages.at(-1)?.content || 'No messages';
        const preview = last.replace(/\n/g, ' ').slice(0, 50);
        const timeAgo = getTimeAgo(c.timestamp);
        const category = c.category || 'general';
        
        div.innerHTML = `
            <div class="conversation-title">${c.title}</div>
            <div class="conversation-preview">${preview}${last.length > 50 ? '…' : ''}</div>
            <div class="conversation-meta">
                <span class="conversation-category">${category}</span>
                <span class="conversation-time">${timeAgo}</span>
            </div>
            <div class="conversation-actions">
                <button class="share-conversation" title="Share conversation"><i class="fas fa-share"></i></button>
                <button class="delete-conversation"><i class="fas fa-trash"></i></button>
            </div>`;
        div.querySelector('.delete-conversation').onclick = e => deleteConversation(c.id, e);
        div.querySelector('.share-conversation').onclick = e => shareConversation(c.id, e);
        list.appendChild(div);
    });
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && 
                   date.getMonth() === today.getMonth() && 
                   date.getFullYear() === today.getFullYear();
    
    if (isToday) {
        return `${hours}:${minutes}`;
    } else {
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
}

/* ---------- chat window helpers ---------- */
function clearChatWindow() {
    const box = document.getElementById('chatMessages');
    box.innerHTML = `
        <div class="welcome-message">
            <h1 class="welcome-title">Semelion AI</h1>
            <p class="welcome-subtitle">Your versatile AI assistant created in Malawi, ready to help with any topic or task.</p>
            <div class="welcome-features">
                <div class="feature-card"><div class="feature-icon"><i class="fas fa-graduation-cap"></i></div><div class="feature-title">Education & Research</div><div class="feature-description">Get help with academic topics, research questions, and learning new concepts.</div></div>
                <div class="feature-card"><div class="feature-icon"><i class="fas fa-lightbulb"></i></div><div class="feature-title">Creative Projects</div><div class="feature-description">Brainstorm ideas, write content, and explore creative solutions to your projects.</div></div>
                <div class="feature-card"><div class="feature-icon"><i class="fas fa-cogs"></i></div><div class="feature-title">Problem Solving</div><div class="feature-description">Analyze complex problems and find practical solutions across various domains.</div></div>
            </div>
        </div>`;
}

/* ---------- append with working Edit / Retry ---------- */
function appendMessageDOM(content, isUser, index, reasoningProcess = null, timestamp = null) {
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const container = document.getElementById('chatMessages');

    const wrapper = document.createElement('div');
    wrapper.className = `message ${isUser ? 'user' : 'bot'}`;
    wrapper.dataset.index = index;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Render content immediately (typing effect removed)
    contentDiv.innerHTML = formatMessage(content);

    // Add timestamp if enabled and timestamp provided
    const settings = JSON.parse(localStorage.getItem('semelion_settings') || '{}');
    if (settings.showTimestamps !== false && timestamp) {
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'message-timestamp';
        timestampDiv.textContent = formatTimestamp(timestamp);
        contentWrapper.appendChild(timestampDiv);
    }

    const actions = document.createElement('div');
    actions.className = 'message-actions';
    
    let actionButtons = '';
    if (isUser) {
        actionButtons = `<button class="action-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn copy-btn" title="Copy"><i class="fas fa-copy"></i></button>`;
    } else {
        actionButtons = `<button class="action-btn copy-btn" title="Copy"><i class="fas fa-copy"></i></button><button class="action-btn retry-btn" title="Regenerate"><i class="fas fa-redo"></i></button>`;
        // Add reasoning button if reasoning process exists
        if (reasoningProcess) {
            actionButtons = `<button class="action-btn reasoning-btn" title="Show Reasoning"><i class="fas fa-brain"></i></button>` + actionButtons;
        }
    }
    
    actions.innerHTML = actionButtons;

    contentWrapper.appendChild(contentDiv);
    contentWrapper.appendChild(actions);

    wrapper.appendChild(avatar);
    wrapper.appendChild(contentWrapper);
    container.appendChild(wrapper);

    /* event wiring */
    actions.querySelector('.copy-btn').onclick = () => navigator.clipboard.writeText(content);

    if (isUser) {
        actions.querySelector('.edit-btn').onclick = () => enableEdit(wrapper, index);
    } else {
        actions.querySelector('.retry-btn').onclick = () => regenerate(index - 1);
        // Add reasoning button handler
        const reasoningBtn = actions.querySelector('.reasoning-btn');
        if (reasoningBtn && reasoningProcess) {
            reasoningBtn.onclick = () => showReasoningModal(reasoningProcess);
        }
    }

    container.scrollTop = container.scrollHeight;
}

/* ---------- input ---------- */
function setupAutoResize() {
    const ta = document.getElementById('messageInput');
    ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    });
    ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('chatForm').dispatchEvent(new Event('submit'));
        }
    });
}

/* ---------- formatting ---------- */

function escapeHtml(html) {
    const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return html.replace(/[&<>"']/g, char => replacements[char]);
}

function formatMessage(text) {
    // First, escape the entire text to prevent HTML injection
    let escapedText = escapeHtml(text);
    
    // Process tables BEFORE auto-detecting HTML code
    escapedText = processTables(escapedText);
    
    // Auto-detect and wrap HTML code that isn't already in code blocks
    escapedText = autoDetectHtmlCode(escapedText);
    
    // Now process markdown formatting on the escaped text
    
    // Handle code blocks first (they should not process other markdown inside)
    escapedText = escapedText.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
        const cls = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${cls}>${code.trim()}</code></pre>`;
    });

    // Handle inline code (after code blocks)
    escapedText = escapedText.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Process the rest of the markdown only outside of code blocks
    const parts = escapedText.split(/(<pre>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>)/);
    
    for (let i = 0; i < parts.length; i++) {
        // Only process parts that are NOT code blocks
        if (!parts[i].startsWith('<pre>') && !parts[i].startsWith('<code>')) {
            let part = parts[i];
            
            // Handle headers
            part = part.replace(/^#+\s+(.*$)/gm, (match, content) => {
                const level = match.match(/^#+/)[0].length;
                const validLevel = Math.min(Math.max(level, 1), 6);
                return `<h${validLevel}>${content}</h${validLevel}>`;
            });

            // Handle bold, italic, strikethrough
            part = part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/~~(.*?)~~/g, '<del>$1</del>');

            // Handle links
            part = part.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

            // Handle blockquotes
            part = part.replace(/^>\s+(.*$)/gm, '<blockquote>$1</blockquote>');

            // Handle lists
            part = part.replace(/^-\s+(.*$)/gm, '<li>$1</li>')
                      .replace(/^\*\s+(.*$)/gm, '<li>$1</li>')
                      .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>');
            
            // Wrap consecutive list items
            part = part.replace(/(<li>.*?<\/li>)+/gs, match => {
                const lines = match.split('</li>').filter(line => line.trim());
                const isOrdered = lines.some(line => line.match(/^<li>\d+\./));
                return isOrdered ? `<ol>${match}</ol>` : `<ul>${match}</ul>`;
            });

            // Handle horizontal rule
            part = part.replace(/^---$/gm, '<hr>');

            parts[i] = part;
        }
    }

    // Rejoin all parts
    let result = parts.join('');

    // Handle line breaks
    result = result.replace(/\n/g, '<br>');

    return result;
}

function processTables(text) {
    // Process markdown tables - handle multiple formats
    return text.replace(/((?:^\|.*\|$\n?)+)/gm, (tableBlock) => {
        const lines = tableBlock.trim().split('\n').filter(line => line.trim());
        
        if (lines.length < 2) return tableBlock; // Not a valid table
        
        // Check if it's a markdown table (has separator line with ---, |, or -)
        const hasSeparator = lines[1].includes('---') || 
                           lines[1].includes('|') || 
                           lines[1].match(/^[\|\-\s:]+$/);
        
        if (!hasSeparator) return tableBlock; // Not a markdown table
        
        let html = '<table>';
        
        // Process header (first line)
        const headers = lines[0].split('|').filter(h => h.trim() !== '');
        html += '<thead><tr>';
        headers.forEach(header => {
            html += `<th>${header.trim()}</th>`;
        });
        html += '</tr></thead>';
        
        // Process rows (skip the separator line if it exists)
        html += '<tbody>';
        for (let i = 1; i < lines.length; i++) {
            // Skip separator lines (lines with only ---, |, - characters)
            const line = lines[i].trim();
            if (line.match(/^[\|\-\s:]+$/) || line.includes('---')) {
                continue;
            }
            
            const cells = line.split('|').filter(c => c.trim() !== '');
            if (cells.length > 0) {
                html += '<tr>';
                cells.forEach(cell => {
                    // Process any markdown formatting within cells (bold, italic, etc.)
                    let cellContent = cell.trim();
                    cellContent = cellContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                           .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                           .replace(/`([^`]+)`/g, '<code>$1</code>')
                                           .replace(/<br>/g, '<br>');
                    html += `<td>${cellContent}</td>`;
                });
                html += '</tr>';
            }
        }
        html += '</tbody></table>';
        
        return html;
    });
}

function autoDetectHtmlCode(text) {
    // Don't process if it contains a table (already processed)
    if (text.includes('<table>') && text.includes('</table>')) {
        return text;
    }
    
    // Patterns that indicate HTML code (more specific to avoid false positives)
    const htmlPatterns = [
        /<(!DOCTYPE|html|head|body|div|span|p|h[1-6]|a|img|script|style|link|meta|title|header|footer|nav|section|article|main|aside|ul|ol|li|table|tr|td|th|form|input|button|textarea|select|option|label)[\s>]/i,
        /<\/?(html|head|body|div|span|p|h[1-6]|a|img|script|style|link|meta|title|header|footer|nav|section|article|main|aside|ul|ol|li|table|tr|td|th|form|input|button|textarea|select|option|label)[^>]*>/i,
        /&[a-z]+;/i, // HTML entities
        /<\?xml/i, // XML declaration
    ];

    // If text contains HTML patterns and isn't already in a code block, wrap it
    const hasHtml = htmlPatterns.some(pattern => pattern.test(text));
    const hasCodeBlock = text.includes('```') || text.includes('<pre>') || text.includes('<code>');
    
    if (hasHtml && !hasCodeBlock) {
        // Check if this looks like a complete HTML document or fragment
        const looksLikeHtml = text.trim().startsWith('<') || 
                             text.includes('</') || 
                             text.includes('/>') ||
                             text.includes('&lt;') ||
                             text.includes('&gt;');
        
        // Additional check: make sure it's not just a table with <br> tags
        const hasTableStructure = text.includes('|') && text.includes('---');
        const hasManyHtmlTags = (text.match(/<[^>]+>/g) || []).length > 3;
        
        if (looksLikeHtml && !hasTableStructure && hasManyHtmlTags) {
            // Wrap the entire content in an HTML code block
            return "```html\n" + text + "\n```";
        }
    }
    
    return text;
}
/* ---------- edit & regenerate ---------- */
function enableEdit(wrapper, idx) {
    const originalMsg = conversations[currentConversationId].messages[idx];

    /* build inline editor */
    const contentDiv = wrapper.querySelector('.message-content');
    contentDiv.className = 'edit-mode';
    contentDiv.innerHTML = `
        <textarea class="edit-textarea">${originalMsg.content}</textarea>
        <div class="edit-actions">
            <button class="action-btn save-edit-btn">
                <i class="fas fa-check"></i> Save & Submit
            </button>
            <button class="action-btn cancel-edit-btn">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>`;

    const ta = contentDiv.querySelector('.edit-textarea');
    
    // Auto-resize textarea
    const autoResize = () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    };
    
    ta.addEventListener('input', autoResize);
    autoResize(); // Initial resize
    
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    /* save */
    contentDiv.querySelector('.save-edit-btn').onclick = () => {
        const newText = ta.value.trim();
        if (!newText) {
            toast('Message cannot be empty', false);
            return;
        }

        /* 1. replace ONLY the user message */
        conversations[currentConversationId].messages[idx].content = newText;

        /* 2. remove every message AFTER it (old bot answer) */
        conversations[currentConversationId].messages.splice(idx + 1);

        /* 3. refresh UI */
        saveConversations();
        clearChatWindow();
        conversations[currentConversationId].messages.forEach((m, i) =>
            appendMessageDOM(m.content, m.isUser, i, m.reasoningProcess, m.timestamp)
        );

        /* 4. re-send */
        sendMessage(newText, true);
        toast('Message updated and sent');
    };

    /* cancel */
    contentDiv.querySelector('.cancel-edit-btn').onclick = () => {
        clearChatWindow();
        conversations[currentConversationId].messages.forEach((m, i) =>
            appendMessageDOM(m.content, m.isUser, i, m.reasoningProcess, m.timestamp)
        );
    };
}

function regenerate(userIdx) {
    /* 1. Find the user message index properly */
    const userMessageIndex = userIdx;
    
    /* 2. Remove the bot message (and anything after it, just in case) */
    conversations[currentConversationId].messages.splice(userMessageIndex + 1);

    /* 3. refresh UI */
    saveConversations();
    clearChatWindow();
    conversations[currentConversationId].messages.forEach((m, i) =>
        appendMessageDOM(m.content, m.isUser, i, m.reasoningProcess, m.timestamp)
    );

    /* 4. re-send the existing user message */
    const userMsg = conversations[currentConversationId].messages[userMessageIndex].content;
    sendMessage(userMsg, true);
}

/* ---------- helpers ---------- */
async function performOnlineSearch(query) {
    try {
        const res = await fetch('/online_search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        const items = (data.results || []).slice(0, 5).map(r => `- ${r.content}`).join('\n');
        return items ? `\n\nOnline search results (summary):\n${items}` : '';
    } catch (e) {
        return '';
    }
}

function startRateLimitCountdown(seconds) {
    const msgSpan = document.getElementById('rateLimitMsg');
    const countdown = document.getElementById('retryCountdown');
    let remaining = seconds;
    msgSpan.style.display = 'inline';
    document.getElementById('sendButton').disabled = true;
    countdown.textContent = remaining;
    const timer = setInterval(() => {
        remaining -= 1;
        countdown.textContent = remaining;
        if (remaining <= 0) {
            clearInterval(timer);
            msgSpan.style.display = 'none';
            document.getElementById('sendButton').disabled = false;
        }
    }, 1000);
}



/* ---------- export conversations ---------- */
function exportConversations() {
    if (Object.keys(conversations).length === 0) {
        toast('No conversations to export', false);
        return;
    }
    
    const exportData = {
        exportDate: new Date().toISOString(),
        totalConversations: Object.keys(conversations).length,
        conversations: Object.values(conversations).map(conv => ({
            id: conv.id,
            title: conv.title,
            timestamp: conv.timestamp,
            messageCount: conv.messages.length,
            messages: conv.messages.map(msg => ({
                content: msg.content,
                isUser: msg.isUser,
                timestamp: msg.timestamp
            }))
        }))
    };
    
    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `semelion-conversations-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast(`✅ Exported ${Object.keys(conversations).length} conversations`);
}

/* ---------- search and filter ---------- */
function setupSearchAndFilter() {
    const searchInput = document.getElementById('searchConversations');
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderConversationsList();
        });
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentCategoryFilter = e.target.value;
            renderConversationsList();
        });
    }
}


/* ---------- offline mode ---------- */
function setupOfflineMode() {
    // Check online status
    updateOnlineStatus();
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
        isOffline = false;
        updateOnlineStatus();
        processOfflineQueue();
    });
    
    window.addEventListener('offline', () => {
        isOffline = true;
        updateOnlineStatus();
    });
}

function updateOnlineStatus() {
    isOffline = !navigator.onLine;
    const statusIndicator = document.getElementById('onlineStatus');
    if (statusIndicator) {
        statusIndicator.textContent = isOffline ? 'Offline' : 'Online';
        statusIndicator.className = isOffline ? 'offline' : 'online';
    }
}

function processOfflineQueue() {
    if (offlineQueue.length === 0) return;
    
    toast(`Processing ${offlineQueue.length} queued messages...`);
    
    // Process queued messages
    offlineQueue.forEach(item => {
        if (item.type === 'message') {
            sendMessage(item.data);
        }
    });
    
    offlineQueue = [];
    toast('All queued messages sent!');
}

function addToOfflineQueue(type, data) {
    offlineQueue.push({ type, data, timestamp: Date.now() });
    toast('Message queued for when you\'re back online');
}

/* ---------- reload KB (no numbers) ---------- */
async function reloadKnowledgeBase() {
    const toast2 = (msg, ok = true) => {
        const n = document.createElement('div');
        n.style.cssText = `position:fixed;top:20px;right:20px;padding:10px 16px;border-radius:6px;color:#fff;font-size:14px;background:${ok ? '#3fb950' : '#f85149'};z-index:9999`;
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 2000);
    };
    try {
        await fetch('/reload_kb', { method: 'POST' });
        toast2('Reloaded ✓');
    } catch {
        toast2('Reload failed', false);
    }
}