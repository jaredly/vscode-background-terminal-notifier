"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const child_process = require("child_process");
const notifier = require("node-notifier");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

const exec = cmd =>
  new Promise((res, rej) =>
    child_process.exec(cmd, (err, stdout, stderr) =>
      err ? rej([err, stderr]) : res([stdout, stderr])
    )
  );

const activePids = async (parentPid, tty) => {
  const [pidout, piderr] = await exec(`ps -t ${tty} -o pid,ppid,start,command`);
  const list = pidout
    .split("\n")
    .slice(1)
    .map(line => {
      const [pid, ppid, start, ...commandParts] = line.trim().split(/\s+/g);
      const command = commandParts.join(" ");
      return { pid, start, command, ppid };
    })
    .filter(line => line.ppid == parentPid);
  const map = {};
  for (const item of list) {
    map[item.pid] = item;
  }
  return map;
};

const sendNotification = (window, command, start) => {
  const notificationSounds = vscode.workspace.getConfiguration('background-terminal-notifier').get('notificationSounds') || false;

  notifier.notify({
    title: "A command completed!",
    message: command,
    timeout: 100,
    closeLabel: 'Ok',
    sound: notificationSounds
  });
};

const startListening = (window, intervals) => {
  return Promise.all(
    window.terminals.map(async terminal => {
      const pid = await terminal.processId;
      const [ttyout, ttyerr] = await exec(`ps -o tty ${pid}`);
      const tty = ttyout.split("\n")[1].trim();
      const initalActive = await activePids(pid, tty);
      if (!Object.keys(initalActive).length) {
        return;
      }
      const pollFrequency = vscode.workspace.getConfiguration('background-terminal-notifier').get('pollFrequency') || 10;
      const id = setInterval(() => {
        activePids(pid, tty).then(pids => {
          for (const pid of Object.keys(initalActive)) {
            if (!pids[pid]) {
              sendNotification(
                window,
                initalActive[pid].command,
                initalActive[pid].start
              );
              delete initalActive[pid];
            }
          }
          if (Object.keys(initalActive).length === 0) {
              clearInterval(id)
          }
        });
      }, pollFrequency * 1000);
      intervals.push(id);
    })
  );
};

const setupWindow = window => {
  const intervals = [];
  window.onDidChangeWindowState(state => {
    if (state.focused) {
      intervals.forEach(id => clearInterval(id));
      intervals.splice(0, intervals.length);
    } else {
      startListening(window, intervals).catch(err => {
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
