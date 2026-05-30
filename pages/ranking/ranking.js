Page({
  data: {
    activeTab: "friends",
    tabs: [
      { key: "friends", label: "好友" },
      { key: "global", label: "全球" },
      { key: "company", label: "公司" },
      { key: "student", label: "留学生" }
    ],
    me: {},
    players: []
  },

  onShow() {
    this.refreshRanking();
  },

  switchTab(event) {
    this.setData({ activeTab: event.currentTarget.dataset.key }, () => this.refreshRanking());
  },

  refreshRanking() {
    const state = getApp().globalData.state;
    const activeTab = this.data.activeTab;
    
    // 确保房间数组有足够的元素
    let room = null;
    if (activeTab === "company" && state.rooms.length > 1) {
      room = state.rooms[1];
    } else if (activeTab === "friends") {
      room = state.rooms[0];
    } else if (activeTab === "global") {
      room = state.rooms[0];
    } else if (activeTab === "student") {
      room = state.rooms[0];
    } else {
      room = state.rooms[0]; // 默认使用第一个房间
    }
    
    const globalExtras = [
      { id: "g1", name: "Mika", score: 410 },
      { id: "g2", name: "Chris", score: 360 }
    ];
    const players = activeTab === "global"
      ? globalExtras.concat(room.players).sort((a, b) => b.score - a.score)
      : room.players.slice().sort((a, b) => b.score - a.score);

    this.setData({
      me: state.me,
      players
    });
  }
});
