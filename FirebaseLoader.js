const FirebaseLoader = {
  init(config) {
    firebase.initializeApp(config);
  },

  loadStreamData(streamKey, callback) {
    firebase.database().ref(`/streams/${streamKey}`).once("value").then((snapshot) => {
      callback(snapshot.val());
    });
  },

  loadAllStreams(callback) {
    firebase.database().ref("/streams").once("value").then((snapshot) => {
      callback(snapshot.val());
    });
  }
};
