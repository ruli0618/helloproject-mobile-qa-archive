/**
  * 静的ページ用
  */
hlpr._staticPage = (function() {
  var utils = hlpr.utils;

  /**
   * ユーザーのログイン状況を確認する為に、問い合わせをする
   */
  function _loadData () {
    console.log("loadData");
    utils.get("/api/menu", {}, undefined, undefined, this);
  }

  return {
    init: function () {
      console.log("*****hlpr._staticPage.init() start");
      hlpr._ContentBase.call(this);
      if(!_.isUndefined(this.resource)){
        if(this.resource.resourceName == 'gacya'){
          this.url = '/content/gacya?menu_id=7';
        }
      }
      //ログイン状態の確認
      _loadData.call(this);

      ko.applyBindings(this, document.getElementById("bindingContext"));
    }
  }
}()).init();