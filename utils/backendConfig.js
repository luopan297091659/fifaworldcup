const backendConfig = {
  appKey: "worldcup",
  baseUrl: "https://kotabi.top",
  tokenStorageKey: "worldcup_token",
  userStorageKey: "worldcup_user",
  timeout: 10000,
  endpoints: {
    login: "/worldcup/login",
    updateProfile: "/worldcup/profile/update",
    uploadAvatar: "/worldcup/profile/avatar",
    home: "/worldcup/home",
    matchDetail: "/worldcup/matches/detail",
    submitPrediction: "/worldcup/predictions/submit",
    rooms: "/worldcup/rooms",
    createRoom: "/worldcup/rooms/create",
    updateRoom: "/worldcup/rooms/update",
    deleteRoom: "/worldcup/rooms/delete",
    joinRoom: "/worldcup/rooms/join",
    cheerRoom: "/worldcup/rooms/cheer",
    ranking: "/worldcup/rankings",
    profile: "/worldcup/profile"
  }
};

module.exports = backendConfig;
