function listenForClicks() {
  document.addEventListener("click", (e) => {
    console.log("listenForClicks: " + e.target.id);

    const TOOLS = ["retracement", "line", "arcs", "channel"];

    /**
     * Just log the error to the console.
     */
    function reportError(error) {
      console.error(`Fibotin fails: ${error}`);
    }

    /**
     * Insert the drawing CSS into the active tab, tell the content
     * script which shape to draw, then close the popup.
     */
    function activateTool(command, tabs) {
      browser.tabs.insertCSS(tabs[0].id, {file: '/data/style.css'})
        .then(() => browser.tabs.sendMessage(tabs[0].id, {command: command}))
        .then(() => window.close())
        .catch(reportError);
    }

    /**
     * Remove the drawing CSS from the active tab,
     * then send a "reset" message to the content script.
     */
    function reset(tabs) {
      browser.tabs.removeCSS(tabs[0].id, {file: '/data/style.css'})
        .catch(reportError);
      browser.tabs.sendMessage(tabs[0].id, {command: "reset"})
        .catch(reportError);
    }

    if (TOOLS.indexOf(e.target.id) !== -1) {
      browser.tabs.query({active: true, currentWindow: true})
        .then((tabs) => activateTool(e.target.id, tabs))
        .catch(reportError);
    }
    if (e.target.id === "reset") {
      browser.tabs.query({active: true, currentWindow: true})
        .then(reset)
        .catch(reportError);
    }
  });
}

/**
 * There was an error executing the script.
 * Display the popup's error message, and hide the normal UI.
 */
function reportExecuteScriptError(error) {
  console.error(`Failed to execute fibotin content script: ${error.message}`);
}


browser.tabs.executeScript({file: "/content-scripts/content.js"})
.then(listenForClicks)
.catch(reportExecuteScriptError);
