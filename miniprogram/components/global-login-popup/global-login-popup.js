const api = require("../../utils/api");

function refreshCurrentPage() {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  if (!page) return;

  if (typeof page.refreshProfile === "function") {
    page.refreshProfile();
    return;
  }
  if (typeof page.loadHome === "function") {
    page.loadHome();
    return;
  }
  if (typeof page.loadRooms === "function") {
    page.loadRooms();
    return;
  }
  if (typeof page.refreshRanking === "function") {
    page.refreshRanking();
    return;
  }
  if (typeof page.loadRoom === "function") {
    page.loadRoom();
    return;
  }
  if (typeof page.loadMatchDetail === "function" && page.data && page.data.matchId) {
    page.loadMatchDetail(page.data.matchId);
  }
}

Component({
  data: {
    visible: false,
    loading: false
  },

  lifetimes: {
    attached() {
      this.syncVisible();
    }
  },

  pageLifetimes: {
    show() {
      this.syncVisible();
    }
  },

  methods: {
    noop() {},

    syncVisible() {
      this.setData({
        visible: !api.isLoggedIn()
      });
    },

    handleLogin() {
      if (this.data.loading) return;

      this.setData({ loading: true });
      api.login({ userInfo: null })
        .then(() => {
          this.setData({ visible: false });
          wx.showToast({ title: "登录成功", icon: "success" });
          refreshCurrentPage();
        })
        .catch((error) => {
          console.error("全局微信登录失败:", error);
          wx.showToast({ title: error.message || "登录失败", icon: "none" });
        })
        .finally(() => {
          this.setData({ loading: false });
        });
    }
  }
});
