/**
  * ハローラジオ
  */

if (!Array.prototype.filter) {
  Array.prototype.filter = function(fun /*, thisp */) {
    "use strict";

    if (this == null) throw new TypeError();

    var t = Object(this),
        len = t.length >>> 0;

    if (typeof fun != "function") throw new TypeError();

    var res = [],
        thisp = arguments[1];

    for (var i = 0; i < len; i++) {
      if (i in t) {
        var val = t[i]; // fun が this を変化させた場合に備えて
        if (fun.call(thisp, val, i, t)) res.push(val);
      }
    }

    return res;
  };
}

hlpr._musicPage = (function() {
  var utils = hlpr.utils;
  var current_time = moment();// new制御に使用

  function _loadData () {
    utils.get("/api/menu", {}, undefined, undefined, this);
  }

  function _loadPlayList (thisArg) {
    var isRelease = function(data){
      return current_time >= moment(data.release_date, "YYYY-MM-DD HH:ss:mm")
          && current_time <= moment(data.end_date, "YYYY-MM-DD HH:ss:mm");
    }

    var isNew = function (data) {
      data.is_new = current_time.diff(data.release_date, 'days') < 1;
      return data;
    }
    var buildData = function(data){
      data.link = "/music/?func=playlist&sc=str_ndi_hpmobile&id=" + data.id + "&shuffle=" + data.shuffle;
      if(data.id_short){
        data.free_link = "/music/?func=playlist&sc=str_ndi_hpmobile&id=" + data.id_short + "&shuffle=" + data.shuffle +"&short=1";
      } else {
        data.free_link = null;
      }
      return data;
    }

    $.getJSON("/music_data/playlist.json", {}, function (datas){
      playlist = datas ? datas.filter(isRelease).map(buildData).map(isNew) : [];
      thisArg.playList(playlist);
    });
  }

  this.openMusic = function(data){
    window.open(data.link, "_blank");
  }

  var mapping = {
    create: function (options) {// this.radioList()
      return new VMComputed(options.data);
    },
    contents: {
      create: function (options) {
        return new contentsVMComputed(options.data);
      }
/*  // list[]に付加情報を入れる場合はこっちを使用すること
    },list: {
      create: function (options) {
        return new listVMComputed(options.data);
      }
*/
    }
  };

  var contentsVMComputed = function (data) {
//    ko.mapping.fromJS(data, mapping, this);// list[]に付加情報を入れる場合はこっちを使用すること
    ko.mapping.fromJS(data, {}, this);
    this.is_new = ko.observable(current_time.diff(this.release_date(), 'days') < 1 ? true : false);
  }

/*  // list[]に付加情報を入れる場合はこっちを使用すること
  var listVMComputed = function (data) {
    ko.mapping.fromJS(data, {}, this);
    this.link = "/music/?func=playlist&sc=str_ndi_hpmobile&id=" + this.id()
                  + "&shuffle=" + this.shuffle();
  }
*/
  var VMComputed = function (data) {
    // 紐づくcontentsを公開日・終了日でフィルター
    // isAfter(undefined)->false  isBefore(undefined)-> true
    // の為、release_date/end_dateがない場合の為に_.isUndefined()を使用
    data.contents = ko.utils.arrayFilter(data.contents, function (content) {
      var isAfterReleaseDate = _.isUndefined (content.release_date) ? true :
                               current_time.isAfter(new moment(content.release_date));
      var isBeforeEndDate    = _.isUndefined (content.end_date) ? true :
                               current_time.isBefore(new moment(content.end_date));

      // contentレベルにrelease_dateがない場合comtentsVMComputed()内の
      // this.release_date()でエラーになるので、ここで追加する
      if (_.isUndefined(content.release_date)) {
        content.release_date = "";
      }

      return isAfterReleaseDate && isBeforeEndDate;
    });
    ko.mapping.fromJS(data, mapping, this);
//    this.is_new = ko.observable(true) // JSONのトップレベルに付加情報が必要な場合
  }

  function _loadRadioList () {
    var onsuccess = function (data) {
      data = ko.utils.arrayFilter(data, function (item) {
        var isAfterReleaseDate = _.isUndefined (item.release_date) ? true :
                                 current_time.isAfter(new moment(item.release_date));
        var isBeforeEndDate =    _.isUndefined (item.end_date) ? true :
                                 current_time.isBefore(new moment(item.end_date));
        return isAfterReleaseDate && isBeforeEndDate;
      });
      ko.mapping.fromJS(data, mapping, this.radioList);
    }

    utils.query('GET', "/music_data/radiolist.json", {}, onsuccess, undefined, this);
  }

  var initProp = {
    title: null,
    description: null,
    contents: {}
  }

  return {
    init: function () {
      console.log("*****hlpr._musicPage.init() start");
      hlpr._ContentBase.call(this);

      //ログイン状態の確認
      _loadData.call(this);

      this.radioList = ko.observableArray([initProp]);// 画面上部のラジオ番組部分
      this.playList = ko.observableArray();// 画面下部のプレイリスト

      _loadRadioList.call(this);// ラジオ番組の読み込み
      _loadPlayList(this);//プレイリスト一覧読込

      ko.applyBindings(this, document.getElementById("bindingContext"));
    },
    /**
     * ラジオリストのプレーヤー一覧タップ
     */
    openTab: function (status, is_login, viewPage, data) {
      // mappingでurl生成すると複雑になる為、ここで行う
      if(is_login & status == 3){
        var params = [
                     ["func", "playlist"],
                     ["id", data.id()],
                     ["sc", "str_ndi_hpmobile"],
                     ["shuffle", data.shuffle()]
                   ];
      } else {

        if(data.id_short){
          var params = [
                       ["func", "playlist"],
                       ["id", data.id_short()],
                       ["sc", "str_ndi_hpmobile"],
                       ["shuffle", data.shuffle()],
                       ["short", '1']
                     ];
        } else {
          utils.showModal();
        }
      }

      var url = "/music/seek" + utils.createUrlParams(params, true);
      var win = window.open(url, "_blank");
      win.focus();
    },
    openMusic: function(status, is_login, viewPage, data) {
      if(is_login & status == 3){
        window.open(data.link, "_blank");
      } else {
        if(data.free_link){
          window.open(data.free_link, "_blank");
        } else {
          if(!hlpr.utils.checkIfMemberCore(status, is_login, viewPage, data, '')){
            return false;
          }
        }
      }
    },
    openAccordion: function (element) {
      $(element).next("ul").slideToggle();
      $(element).children("span").toggleClass("open");
    }
  }
}()).init();

function openTab(event) {
  window.open(event, "_blank");
}
