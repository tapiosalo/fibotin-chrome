async function main() {
  let tabId;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab.id;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content.js'],
    });
  } catch (error) {
    console.error(`Failed to execute fibotin content script: ${error.message}`);
    return;
  }
  listenForClicks(tabId);
}

function listenForClicks(tabId) {
  const TOOLS = ['retracement', 'line', 'arcs', 'channel'];

  function reportError(error) {
    console.error(`Fibotin fails: ${error}`);
  }

  async function activateTool(command) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['data/style.css'] });
      await chrome.tabs.sendMessage(tabId, { command });
      window.close();
    } catch (error) {
      reportError(error);
    }
  }

  async function reset() {
    try {
      await chrome.scripting.removeCSS({ target: { tabId }, files: ['data/style.css'] });
      await chrome.tabs.sendMessage(tabId, { command: 'reset' });
    } catch (error) {
      reportError(error);
    }
  }

  document.addEventListener('click', (e) => {
    if (TOOLS.indexOf(e.target.id) !== -1) activateTool(e.target.id);
    else if (e.target.id === 'reset') reset();
  });
}

main();
