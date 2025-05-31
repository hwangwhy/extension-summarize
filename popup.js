const output = document.getElementById("output");
const historyList = document.getElementById("history-list");

// Function to format date
const formatDate = (date) => {
  return new Date(date).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Function to save history
const saveToHistory = async (type, text, result) => {
  try {
    // Get existing history
    const { history = [] } = await chrome.storage.local.get('history');
    
    // Create new history item
    const newItem = {
      timestamp: new Date().toISOString(),
      type,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), // Truncate long text
      result: JSON.stringify(result)
    };
    
    // Add new item to beginning of array
    history.unshift(newItem);
    
    // Keep only last 10 items
    const updatedHistory = history.slice(0, 10);
    
    // Save to storage
    await chrome.storage.local.set({ history: updatedHistory });
    
    // Update UI
    displayHistory();
  } catch (err) {
    console.error('Error saving history:', err);
  }
};

// Function to display history
const displayHistory = async () => {
  try {
    const { history = [] } = await chrome.storage.local.get('history');
    
    historyList.innerHTML = history.map(item => `
      <div class="history-item">
        <div class="timestamp">${formatDate(item.timestamp)}</div>
        <div class="function">${getFunctionName(item.type)}</div>
        <div class="text">${item.text}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error displaying history:', err);
  }
};

// Function to get function name in Vietnamese
const getFunctionName = (type) => {
  const names = {
    summarize: '📝 Tóm Tắt',
    keywords: '🔑 Từ Khóa',
    topics: '📚 Chủ Đề'
  };
  return names[type] || type;
};

const sendToAPI = async (endpoint, text) => {
  try {
    console.log('Sending to API:', endpoint, text);
    
    // Create FormData object
    const formData = new FormData();
    formData.append('text', text.trim());

    console.log('Sending request to:', `http://127.0.0.1:8000/${endpoint}`);
    const response = await fetch(`http://127.0.0.1:8000/${endpoint}`, {
      method: "POST",
      headers: { 
        "Accept": "application/json"
      },
      body: formData
    });
    
    console.log('API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('API Response data:', data);
    output.textContent = JSON.stringify(data, null, 2);
    
    // Save to history
    await saveToHistory(endpoint, text, data);
  } catch (err) {
    console.error('API Error:', err);
    output.textContent = "Lỗi gọi API: " + err.message;
  }
};

const handleClick = (type) => {
  console.log('Button clicked:', type);
  
  // First check if we can access the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error('No active tab found');
      output.textContent = "Không thể truy cập tab hiện tại.";
      return;
    }

    console.log('Current tab:', tabs[0]);
    
    // Try to inject the content script first
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['content.js']
    }).then(() => {
      console.log('Content script injected');
      
      // Now send the message
      chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, (response) => {
        console.log('Response from content script:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          output.textContent = "Lỗi: " + chrome.runtime.lastError.message;
          return;
        }
        
        if (response?.text && response.text.trim()) {
          const endpointMap = {
            summarize: "summary",
            keywords: "keywords",
            topics: "topic"
          };
          sendToAPI(endpointMap[type], response.text);
        } else {
          output.textContent = "Không có văn bản được chọn.";
        }
      });
    }).catch(err => {
      console.error('Script injection error:', err);
      output.textContent = "Lỗi: Không thể chạy extension trên trang này.";
    });
  });
};

// Initialize history display when popup opens
document.addEventListener('DOMContentLoaded', displayHistory);

document.getElementById("btn-summary").addEventListener("click", () => handleClick("summarize"));
document.getElementById("btn-keywords").addEventListener("click", () => handleClick("keywords"));
document.getElementById("btn-topics").addEventListener("click", () => handleClick("topics"));
