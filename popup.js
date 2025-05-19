const output = document.getElementById("output");

const sendToAPI = async (endpoint, text) => {
  try {
    const response = await fetch(`https://your-api-domain.com/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await response.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = "Lỗi gọi API: " + err.message;
  }
};

const handleClick = (type) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, (response) => {
      if (response?.text) {
        sendToAPI(type, response.text);
      } else {
        output.textContent = "Không có văn bản được chọn.";
      }
    });
  });
};

document.getElementById("btn-summary").addEventListener("click", () => handleClick("summarize"));
document.getElementById("btn-keywords").addEventListener("click", () => handleClick("keywords"));
document.getElementById("btn-topics").addEventListener("click", () => handleClick("topics"));
