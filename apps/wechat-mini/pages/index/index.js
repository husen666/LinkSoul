Page({
  data: {
    url: '',
  },
  onLoad() {
    const app = getApp();
    this.setData({
      url:
        (app.globalData && app.globalData.webviewUrl) ||
        'https://example.com/linksoul/mobile/',
    });
  },
});
