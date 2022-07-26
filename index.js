"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const child_process = require("child_process");
const ps = require("ps-node");
const notifier = require("node-notifier");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

const activePids = (parentPid) => {
  return new Promise((resolve, reject) => {
    ps.lookup({ ppid: parentPid }, function (err, list) {
      if (err) {
        reject(err);
      }

      const map = {};
      for (const item of list) {
        map[item.pid] = { pid: item.pid, command: item.command };
      }

      resolve(map);
    });
  });
};

const sendNotification = (window, command) => {
  const notificationSounds =
    vscode.workspace
      .getConfiguration("background-terminal-notifier")
      .get("notificationSounds") || false;

  notifier.notify({
    title: "A command completed!",
    message: command,
    timeout: 100,
    closeLabel: "Ok",
    sound: notificationSounds,
  });
};

const startListening = (window, intervals) => {
  return Promise.all(
    window.terminals.map(async (terminal) => {
      const pid = await terminal.processId;
      const initialActive = await activePids(pid);

      if (!Object.keys(initialActive).length) {
        return;
      }

      const pollFrequency =
        vscode.workspace
          .getConfiguration("background-terminal-notifier")
          .get("pollFrequency") || 10;

      const id = setInterval(() => {
        activePids(pid).then((pids) => {
          for (const pid of Object.keys(initialActive)) {
            if (!pids[pid]) {
              sendNotification(window, initialActive[pid].command);
              delete initialActive[pid];
            }
          }
          if (Object.keys(initialActive).length === 0) {
            clearInterval(id);
          }
        });
      }, pollFrequency * 1000);
      intervals.push(id);
    })
  );
};

const setupWindow = (window) => {
  const intervals = [];
  window.onDidChangeWindowState((state) => {
    if (state.focused) {
      intervals.forEach((id) => clearInterval(id));
      intervals.splice(0, intervals.length);
    } else {
      startListening(window, intervals).catch((err) => {
        vscode.window.showErrorMessage(
          "Error while listening for process end: " + err
        );
      });
    }
  });
};

function activate(context) {
  setupWindow(vscode.window);
}
exports.activate = activate;
function deactivate() {}
exports.deactivate = deactivate;
