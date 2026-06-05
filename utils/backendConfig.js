const backendConfig = {
  appKey: "worldcup",
  baseUrl: "https://kotabi.top",
  tokenStorageKey: "worldcup_token",
  userStorageKey: "worldcup_user",
  timeout: 10000,
  endpoints: {
    login: "/worldcup/login",
    home: "/worldcup/home",
    matchDetail: "/worldcup/matches/detail",
    submitPrediction: "/worldcup/predictions/submit",
    rooms: "/worldcup/rooms",
    cheerRoom: "/worldcup/rooms/cheer",
    ranking: "/worldcup/rankings",
    profile: "/worldcup/profile"
  }
};

module.exports = backendConfig;
