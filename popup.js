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
    
    historyList.innerHTML = history.map((item, index) => {
      // Parse and format the result for display
      let formattedResult = '';
      try {
        const parsedResult = JSON.parse(item.result);
        formattedResult = formatResponse(parsedResult, item.type);
        // Truncate if too long for preview
        if (formattedResult.length > 100) {
          formattedResult = formattedResult.substring(0, 100) + '...';
        }
      } catch (err) {
        formattedResult = item.result.substring(0, 100) + '...';
      }
      
      return `
        <div class="history-item" data-index="${index}">
          <div class="timestamp">${formatDate(item.timestamp)}</div>
          <div class="function">${getFunctionName(item.type)}</div>
          <div class="text">${item.text}</div>
          <div class="result">${formattedResult}</div>
          <div class="click-hint">👆 Click để xem chi tiết</div>
        </div>
      `;
    }).join('');

    // Add click event listeners to all history items
    const historyItems = historyList.querySelectorAll('.history-item');
    historyItems.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index'));
        console.log('History item clicked, index:', index);
        showHistoryDetail(index);
      });
    });
  } catch (err) {
    console.error('Error displaying history:', err);
  }
};

// Function to show full history detail when clicked
const showHistoryDetail = async (index) => {
  try {
    console.log('showHistoryDetail called with index:', index);
    const { history = [] } = await chrome.storage.local.get('history');
    const item = history[index];
    console.log('Retrieved history item:', item);
    
    if (item) {
      // Parse and format the full result
      let fullResult = '';
      try {
        const parsedResult = JSON.parse(item.result);
        fullResult = formatResponse(parsedResult, item.type);
        console.log('Formatted result:', fullResult);
      } catch (err) {
        console.error('Error parsing result:', err);
        fullResult = item.result;
      }
      
      // Show in output section
      output.innerHTML = `
        <div class="history-detail">
          <div class="history-detail-header">
            <span class="function-badge">${getFunctionName(item.type)}</span>
            <span class="timestamp-badge">${formatDate(item.timestamp)}</span>
          </div>
          <div class="original-text">
            <strong>Văn bản gốc:</strong><br>
            ${item.text}
          </div>
          <div class="result-content">
            <strong>Kết quả:</strong><br>
            ${fullResult}
          </div>
        </div>
      `;
      console.log('Output HTML updated');
    } else {
      console.error('No history item found at index:', index);
    }
  } catch (err) {
    console.error('Error showing history detail:', err);
    output.textContent = "Lỗi khi hiển thị chi tiết lịch sử.";
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

// Function to format API response for display
const formatResponse = (data, endpoint) => {
  try {
    // If data is a string, return it directly
    if (typeof data === 'string') {
      return data;
    }

    // Format based on endpoint type
    switch (endpoint) {
      case 'summary':
        if (data.summary) {
          return `📝 TÓM TẮT:\n\n${data.summary}`;
        }
        break;
      
      case 'keywords':
        if (data.keywords && Array.isArray(data.keywords)) {
          return `🔑 TỪ KHÓA:\n\n${data.keywords.map(keyword => `• ${keyword}`).join('\n')}`;
        }
        break;
      
      case 'topic':
        if (data.topics && Array.isArray(data.topics)) {
          return `📚 CHỦ ĐỀ:\n\n${data.topics.map(topic => `• ${topic.label} (${Math.round(topic.score * 100)}%)`).join('\n')}`;
        }
        break;
    }

    // Fallback: try to extract meaningful content
    if (data.result) {
      return data.result;
    }
    if (data.text) {
      return data.text;
    }
    if (data.content) {
      return data.content;
    }

    // If nothing else works, show formatted JSON
    return JSON.stringify(data, null, 2);
  } catch (err) {
    console.error('Error formatting response:', err);
    return JSON.stringify(data, null, 2);
  }
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
    
    // Format the response nicely instead of showing raw JSON
    output.textContent = formatResponse(data, endpoint);
    
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
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');
  displayHistory();
  
  // Test function to check if history exists
  setTimeout(async () => {
    const { history = [] } = await chrome.storage.local.get('history');
    console.log('Current history:', history);
    console.log('History items count:', history.length);
  }, 500);
});

document.getElementById("btn-summary").addEventListener("click", () => handleClick("summarize"));
document.getElementById("btn-keywords").addEventListener("click", () => handleClick("keywords"));
document.getElementById("btn-topics").addEventListener("click", () => handleClick("topics"));
