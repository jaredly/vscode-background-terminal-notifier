const notifier = require("node-notifier");

notifier.notify({
  title: "start",
  message: "test",
  timeout: 3,
  closeLabel: "Ok",
  sound: true,
});
