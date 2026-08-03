
/**
 * 共通の名前空間
 */
var hlpr = hlpr || {};
console.log("**********base.js");

hlpr.resources = {

  // 各メニューのTOPページのviewerとそのリソース名、また各ページの閲覧可能な会員情報
  index: [
    // 3page structures
    {viewer: "/dialy/tour", resourceName: "tour", visibleForAtIndex: 0, visibleForAtList: 0, visibleForAtDetail: 2},// menu_id=2
    {viewer: "/content/qa", resourceName: "qa", visibleForAtIndex: 0, visibleForAtList: 0, visibleForAtDetail: 2, visibleForAtAsk: 2},// menu_id=6
    {viewer: "/photo/hello", resourceName: "hello", visibleForAtIndex: 2, visibleForAtList: 2, visibleForAtDetail: 2},// menu_id=4
    {viewer: "/photo/shop", resourceName: "shop", visibleForAtIndex: 2, visibleForAtList: 2, visibleForAtDetail: 2},// mneu_id=5
    {viewer: "/info/faq", resourceName: "faq", visibleForAtAsk: 0},
    {viewer: "/info/movie", resourceName: "movie", visibleForAtIndex: 0, visibleForAtList: 0, visibleForAtDetail: 0},// menu_id=17

    // 2page structures
    {viewer: "/dialy/member", resourceName: "member", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=3
    {viewer: "/content/sns", resourceName: "sns", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=9
    {viewer: "/info/special", resourceName: "special", visibleForAtIndex: 0, visibleForAtDetail: 2, visibleForAtContent: 2, visibleForAtForm: 2},// menu_id=11
    {viewer: "/info/news", resourceName: "news", visibleForAtIndex: 0, visibleForAtDetail: 0},// menu_id=??

    {viewer: "/content/gacya", resourceName: "gacya", visibleForAtList: 2, visibleForAtDetail: 2},
    {viewer: "/mail/magazine", resourceName: "mail", visibleForAtIndex: 2},// menu_id=8
    {viewer: "/info/message", resourceName: "message", visibleForAtIndex: 2, visibleForAtDetail: 2},// message
    {viewer: "/info/music", resourceName: "music", visibleForAtIndex: 0, visibleForAtDetail: 0},//
    {viewer: "/authorize/select", resourceName: "select", visibleForAtIndex: 0},
    {viewer: "/content/artist", resourceName: "artist", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=13
    {viewer: "/content/artist2", resourceName: "artist2", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=15
    {viewer: "/content/artist3", resourceName: "artist3", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=16
    {viewer: "/content/artist4", resourceName: "artist4", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=19
    {viewer: "/content/artist5", resourceName: "artist5", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=20
    {viewer: "/content/artist6", resourceName: "artist6", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=21
    {viewer: "/content/artist7", resourceName: "artist7", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=22
    {viewer: "/content/artist8", resourceName: "artist8", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=23
    {viewer: "/content/artist9", resourceName: "artist9", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=24
    {viewer: "/content/artist10", resourceName: "artist10", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=25
    {viewer: "/content/artist11", resourceName: "artist11", visibleForAtIndex: 0, visibleForAtDetail: 2},// menu_id=27
    {viewer: "/content/manga", resourceName: "manga", visibleForAtIndex: 0, visibleForAtList: 2 ,visibleForAtDetail: 2},// menu_id=18
    {viewer: "/info/form", resourceName: "form", visibleForAtIndex: 0, visibleForAtDetail: 2, visibleForAtForm: 2}// menu_id=14
  ],
  amount: {2: "400", 3: "700"},
  cookie: {
    name: "refurl"
  },
  newMarks: {
    base: 1
/*    base: 1,
    exception: {
        top: 1
    }
*/
  }
};

/**
 * ファイルを分割するときは各モジュールより先に読み込むようにする
 */
hlpr.utils = {

  /**
   * アクセス可能な会員かどうかを返す
   * ログイン状態と、会員種別で判断
   * @param {number} visibleFor ページの表示可能なユーザーステータス
   * @param {number} userStatus ユーザーステータス
   */
  isReadable: function (visibleFor, userStatus, isLogin) {

    if (_.isUndefined(visibleFor) || visibleFor == "0") {
      return true;
    }

    if (!_.isUndefined(userStatus) && ( isLogin && visibleFor <= userStatus)) {
      return true;
    }
    return false;
  },
  setCookie: function (url) {
    var expire = new Date();
    expire.setTime(expire.getTime() + 1000 * 3600);//1hour
//    expire.setTime(expire.getTime() + 1000 * 60);//1min

    // 念の為refurlの初期化
    // document.cookie = hlpr.resources.cookie.name + "=;";
    document.cookie = hlpr.resources.cookie.name + "="+encodeURIComponent(url)+";"
                    + "expires="+expire.toUTCString()+";"
                    + "path=/;"
  },
  /**
   * クッキーの削除
   * expiresは、過去を指定しておくことでブラウザが削除してくれる
   * ※ただし、削除タイミングはブラウザ依存。動作的にはクッキーを含めた送受信が発生して削除される事が多い
   */
  deleteCookie: function () {
    document.cookie = hlpr.resources.cookie.name + "=;"
                    + "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  },
  readCookie: function ( name ) {
    var result = null;
    var cookieName = name + '=';
    var allcookies = document.cookie;

    var position = allcookies.indexOf( cookieName );
    if( position != -1 ) {
        var startIndex = position + cookieName.length;

        var endIndex = allcookies.indexOf( ';', startIndex );
        if( endIndex == -1 ) {
            endIndex = allcookies.length;
        }

        result = decodeURIComponent( allcookies.substring( startIndex, endIndex ) );
    }

    return result;
  },
  /**
   * API問い合わせ
   * 全てのGET-API問い合わせに対して、アクセス可能かの判断を行い、アクセス不可の場合はモーダルの表示
   * アクセス判断は、API成功時必ず実行
   * @param {string} url APIのURL
   * @param {object} params クエリパラメータ
   * @param {function} onsuccess 成功時のコールバック
   * @param {function} onerror 失敗時のコールバック undefinedの場合、リロードダイアログの表示
   * @param {object} thisArg コールバック実行時のthis
   */
  get: function (url, params, onsuccess, onerror, thisArg) {

    var success = function (data) {
      // URL直打ちで来た場合の対処
      // ユーザーが、このページにアクセス不可能な会員の場合、問答無用でTOPページへ遷移させる
      // リンククリックでアクセス可能かどうかの判別をする場合はcheckIfMember()を各リンクへ実装する
      if (!hlpr.utils.isReadable(thisArg.visibleFor, data.user_status, data.is_login)){
        hlpr.utils.setCookie(location.href.replace(location.origin, ''));
        window.location.replace("/?modal=1");
        return;
      } else {
        hlpr.utils.deleteCookie();
      }

      // 会員情報のセット（全画面共通）
      thisArg.user_status(data.user_status);
      thisArg.is_login(data.is_login);

      if (_.isFunction(onsuccess)) {
        onsuccess.call(thisArg, data);
      }
    }

    hlpr.utils.query('GET', url, params, success, onerror, thisArg);
  },
  getJson: function (url, params, onsuccess, onerror, thisArg) {

    var success = function (data) {
      if (!hlpr.utils.isReadable(thisArg.visibleFor, data.user_status, data.is_login)){
        hlpr.utils.setCookie(location.href.replace(location.origin, ''));
        window.location.replace("/?modal=1");
        return;
      } else {
        hlpr.utils.deleteCookie();
      }
      if (_.isFunction(onsuccess)) {
        onsuccess.call(thisArg, data);
      }
    }

    hlpr.utils.query('GET', url, params, success, onerror, thisArg);
  },
  /**
   * API問い合わせ
   * エラー時のリロードモーダル表示は、onerrorがfunction時実行されないので注意
   * @param {string} url APIのURL
   * @param {object} params クエリパラメータ
   * @param {function} onsuccess 成功時のコールバック
   * @param {function} onerror 失敗時のコールバック undefinedの場合、リロードダイアログの表示
   * @param {object} thisArg コールバック実行時のthis
   */
  query: function (verb, url, params, onsuccess, onerror, thisArg) {
    params = params || {};
    $.ajax({
      url: url,
      type: verb,
      cache: false,
      data: params,
      dataType: "JSON",
      success: function(data) {
        if (_.isFunction(onsuccess)) {
          onsuccess.call(thisArg, data);
        }
      }
    }).fail(function(e) {
      if (_.isFunction(onerror)) {
        onerror.call(thisArg, e);
      } else {
        var msg = "";
        switch(e.status) {
          case 401: // 認証が必要
              window.location.replace("/?modal=1")
              break;
          case 404:
          case 405:
              msg = "データ取得に失敗しました。<br>回線状況を確認して、再読み込みして下さい。";
              break;
          case 410:
          case 400:
              msg = "現在表示するメッセージはございません。"
              break;
          default:
              break;
        }
        if (!_.isEmpty(msg)) {
          hlpr.utils.showReload(msg);
        }
      }
    })
  },
  post: function (url, params, onsuccess, onerror, thisArg) {
    hlpr.utils.query('POST', url, params, onsuccess, onerror, thisArg);
  },
  delete: function (url, params, onsuccess, onerror, thisArg) {
    hlpr.utils.query('DELETE', url, params, onsuccess, onerror, thisArg);
  },
  put: function (url, params, onsuccess, onerror, thisArg) {
    hlpr.utils.query('PUT', url, params, onsuccess, onerror, thisArg);
  },
  /**
   * 有料コンテンツにアクセスした時のダイアログの表示
   * 各JSのpublicに指定して、html内各リンクのonclickで呼び出しする
   * @param {object} nextPageVisibleFor observableではない。次のページの公開範囲
   */
  checkIfMember: function(userStatus, isLogin, nextPageVisibleFor, data) {
    // checkIfMemberCoreのreturnだと、制御できない為、返り値から更にreturn trueする必要があった為
    if (hlpr.utils.checkIfMemberCore(userStatus, isLogin, nextPageVisibleFor, data, "")){
      return true;
    }

  },
  /**
   * トップ画面のフリック（flicksimple）内では、下記挙動になる
   * 1.flicksimpleで次の遷移先を設定
   * 2.checkIfmember()
   * 3.showModal()->モーダル出力
   * 4.flicksimpleで次画面へ遷移
   * その為、該当部分のlink先を空にして、JSで画面遷移させる必要がある
   * #param moveAlways trueチェックなしに遷移させる
   */
  checkIfMemberForFlick: function (userStatus, isLogin, nextPageVisibleFor, movePage, moveAlways, data) {
    if (moveAlways) {
      location.href = movePage;
      return false;
    }
    hlpr.utils.checkIfMemberCore(userStatus, isLogin, nextPageVisibleFor, data, movePage);
  },
    checkIfMemberForFlickSpecial: function (userStatus, isLogin, nextPageVisibleFor, movePage, target, data) {
    if (!isLogin || userStatus < nextPageVisibleFor) {
      hlpr.utils.setCookie(movePage);
      hlpr.utils.showModal(nextPageVisibleFor);
      return false;
    }
    if (movePage) {
      if(target == '_blank'){
        window.open(movePage);
      } else{
        location.href = movePage;
      }
    }else{
      return true;
    }
  },
  /**
   * 呼び出されるメソッドによって、次のページ（クッキーにセットする値）を保持している引数が異なる
   */
  checkIfMemberCore: function(userStatus, isLogin, nextPageVisibleFor, data, movePage) {

    // 次ページの公開フラグとユーザーステータスの比較
    if (!isLogin || userStatus < nextPageVisibleFor) {
      // モーダルダイアログの表示

      if(get_menu_parameter() == '10'){
       url =  '/info/music?menu_id=10';
     }else{
      var url = movePage;
      if (_.isEmpty(movePage) ){
        url = decodeURIComponent(data.url);
      };
    };
      hlpr.utils.setCookie(url);
      hlpr.utils.showModal(nextPageVisibleFor);
      return false;
    } else {
      hlpr.utils.deleteCookie();
    }

    if (movePage) {
      location.href = movePage;
    } else {
      // knockoutのclickバインドしている為、trueを返す必要がある
      return true;
    }
  },
  /**
   * モーダルダイアログの表示とvmのbinding
   */
  showModal: function(visibleFor) {
    hlpr.utils.modalDisplay("#modal-content");
    hlpr._registration().init(visibleFor);
  },
  /**
   * 更新ダイアログを表示する
   * APIデータ取得でエラーが有った場合に使用
   **/
  showReload: function(msg) {
    if (!_.isEmpty(msg)) {
      $("#reload_comment").html(msg);
    }
    hlpr.utils.modalDisplay("#reload-content");
  },
  /**
   * モーダルの中を自由に変える甩
   * @param msg モーダルの中のDOM要素
   */
  showArrangeableModal: function (msg) {
    $('#arrangeable-modal-body').html(msg);
    hlpr.utils.modalDisplay("#arrangeable-modal");
    hlpr._arrangeableModal().init("arrangeable-modal");
  },
  closeArrangeableModal: function () {
    hlpr.utils.modalCloseByElement("#arrangeable-modal");
  },
  /**
   * elementに指定したモーダルダイアログを表示する
   */
  modalDisplay: function (element) {
    // overlayの表示
    $("body").append('<div id="modal-overlay"></div>');
    $("#modal-overlay").fadeIn("normal");

    // ダイアログの表示位置の取得
    centeringModalSyncer(element);

    // ダイアログの表示
    $(element).fadeIn("normal");
  },
  modalClose: function () {
    hlpr.utils.modalCloseByElement("#modal-content");
/*
    $("#modal-content, #modal-overlay").fadeOut("slow", function() {
      $("#modal-overlay").remove();
    });
*/
  },
  modalCloseByElement: function (element) {
    $("html, body").removeClass("lock");// form-content用
    $(".modal-wrap").hide();
    $(element + ", #modal-overlay").fadeOut("slow", function () {
      $("#modal-overlay").remove();
    });
  },
  imageUrl: function (sk, mf) {
    return "/materials/viewer?secretKey=" + sk + "&material_file=" + mf;
  },
  /**
   * content文字列内に含まれる画像タイトル箇所をimgタグへ変換
   */
  setImageOnContent: function (content, imageTitle, sk, mf) {
    if (_.isEmpty(content) || _.isEmpty(imageTitle) || _.isEmpty(sk) || _.isEmpty(mf)) return content;
    var imageGuardStart = "<div class='img_guard_body'><span class='img_guard'></span>";
    var logWrapper = "<img class='logo_wrapper' src='/images/images_wrapper_log.jpg' />";
    var imageGuardEnd = "</div>";
    var imageTag = "<img class='full' src='" + hlpr.utils.imageUrl(sk, mf) +"'>"
    var reg = new RegExp(imageTitle, 'g');
    return content.replace(reg, imageGuardStart + imageTag + logWrapper + imageGuardEnd);
  },
  setImageOnContentForInfo: function (content, imageTitle, sk, mf) {
    if (_.isEmpty(content) || _.isEmpty(imageTitle) || _.isEmpty(sk) || _.isEmpty(mf)) return content;
    var imageGuardStart = "<div class='img_guard_body'><span class='img_guard'></span>";
    var logWrapper = "<img class='logo_wrapper' src='/images/images_wrapper_log.jpg' />";
    var imageGuardEnd = "</div>";
    var imageTag = "<img class='full' src='" + hlpr.utils.imageUrl(sk, mf) +"&info=true'>"
    var reg = new RegExp(imageTitle, 'g');
    return content.replace(reg, imageGuardStart + imageTag + logWrapper + imageGuardEnd);
  },
  encodeToHtml: function (content) {
    if (_.isEmpty(content)) {
      return "";
    }
    return content.replace(/\n/g, "<br>")
  },
  /**
   * 画面サイズに合わせて、DOM要素のサイズ変更と画面表示位置を変更する
   */
  setImageCss: function (element) {
    var imgW = 600;
    var imgH = 800;
    //ウィンドウサイズ取得
    var winW = window.innnerWidth ? window.innnerWidth :$(window).width();
    var winH = (window.innerHeight ? window.innerHeight:$(window).height()) - 54;
    var scaleW = winW / imgW;
    var scaleH = winH / imgH;
    var fixScale = Math.min(scaleW, scaleH);
    var setW = imgW * fixScale;
    var setH = imgH * fixScale;
    var moveX = Math.floor((winW - setW) / 2);
    var moveY = Math.floor((winH  - setH) / 2);
//    console.log("winW:" + winW + ":winH:" + winH + ":setW:" + setW + ":setH:" + setH + ":scaleW:" + scaleW + ":scaleH:" + scaleH + ":moveX:" + moveX + ":moveY:" + moveY);
    $(element).css({
      'width': setW,
      'height': setH,
      'left' : moveX,
      'top' : moveY
    });
  },
  /**
   * クエリーパラメータを分解して、連想配列として返す
   */
  params: function () {
    var result = {};
    if( 1 < window.location.search.length ) {
        var parameters = window.location.search.substring(1).split( '&' );
        for( var i = 0; i < parameters.length; i++ ) {

            var element = parameters[ i ].split( '=' );
            var paramName = decodeURIComponent( element[ 0 ] );
            var paramValue = decodeURIComponent( element[ 1 ] );
            result[ paramName ] = paramValue;
        }
    }
    return result;
  },// end params
  /**
   * URLのパラメータ文字列を組み立てる
   * @param {array} params 2次元配列で[idx=xxxx]の組み合わせの配列。
   *                       xxx部分の指定がない場合は返却値に含めない
   * @param {boolean} withStart 返却するパラメータ文字列の先頭に"?"をつけるかどうか
   */
  createUrlParams: function (params, withStart) {
    var query = "";
    if (withStart) {
      query += "?";
    }
    return query +
               _.filter (
                   _.map (params, function (pair) {
                        if (_.isUndefined(pair[1])) {
                            return;
                        }
                        return pair.join("=");
                   }),
                   function (one) {
                       return !_.isUndefined(one);
                   }).join("&");
  },
  /**
   * 日付をyyyy/MM/ddフォーマットへ変換
   */
  dateFormat: function (date) {
    if (!date) {
      return "";
    }
    var d = new Date(date);
    return (d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate());
  },
  /**
   * パラメータのviewerから対象ページのvisibleForを取得する
   * @param string viewer hlpr.resources.indexのviewer値
   * @param array viewerに対応したresoucesの配列
   * @return number viewerに対応したvisibleFor値 viewerがemptyの場合0
   */
  getVisibleFor: function (viewer, resource) {
    if (_.isEmpty(viewer)) {
      return 0;
    }
    var temp = window.location.pathname.replace(viewer, '');
    return resource["visibleForAt" + (!temp.length ? "Index" : temp.charAt(1).toUpperCase() + temp.slice(2))];
  },
  /**
   * @param number diffDays 何日差か
   * @param date today dateオブジェクト undefinedの時だけメソッド内で生成させる
   */
  calcIfIsNew: function (xday, diffDays, today) {
    var ret = false;
    if (_.isUndefined(today)) {
      today = new Date();
    }
    var temp = (today).getTime() - (new Date(xDay)).getTime();
    if ( temp >= 0 && temp <= 86400 * 1000 * diffDays) {
      ret = true;
    }
    return ret;
  }
};

/**
 * 指定されたcontentタグの高さ・幅から画面の中央へ表示するCSS付与
 * 画面回転時はmain.html内で呼び出しされる
 */
function centeringModalSyncer(content){
  //画面(ウィンドウ)の幅、高さを取得
  var w = $(window).width();
  var h = $(window).height();

  //コンテンツ(#modal-content)の幅、高さを取得
  var cw = $(content).outerWidth(true);//true = get px including margin px
  var ch = $(content).outerHeight(true);

  var top = (h - ch)/2;
  if (h < ch) {
    top = 10;
  }

  $(content).css({"left": ((w - cw)/2) + "px","top": top + "px"})
}

/**
 * 会員登録ダイアログ
 * モーダルダイアログ表示する時にinit()で呼び出す
 */
hlpr._registration = (function() {
  var utils = hlpr.utils;

  function modalClose() {
    utils.modalClose();
  }
  /**
   * Cookieをセットさせる
   * 本当ならCookieセットする箇所をまとめたいが、そうすると結構な量の構造変更が必要になる為
   * 複数箇所でCookieのセットは複数箇所で行う
   */
  function toCarrierSelect() {

    // Cookieにデータがない場合、referrerから前のURLを取得する
    if (_.isEmpty(utils.readCookie(hlpr.resources.cookie.name))) {
      utils.setCookie(document.referrer.replace(location.origin, ""));
    }

    location.href = "/authorize/select";
  }

  return {
    init: function(visibleFor) {
      console.log("hlpr.registration");
      this.amount = ko.observable(hlpr.resources.amount[visibleFor]);
      ko.cleanNode(document.getElementById("modal-content"));//複数回表示対策

      ko.applyBindings(this, document.getElementById("modal-content"));
    },
    modalClose: modalClose,
    toCarrierSelect: toCarrierSelect
  };

});
hlpr._arrangeableModal = (function() {
  var utils = hlpr.utils;

  function closeArrangeableModal() {
    utils.closeArrangeableModal();
  }
 return {
    init: function() {
      var dom = "arrangeable-modal";
      ko.cleanNode(document.getElementById(dom));//複数回表示対策
      ko.applyBindings(this, document.getElementById(dom));
    },
    closeArrangeableModal: closeArrangeableModal
  };

});
/**
 * 各モジュールのinit()内で呼ぶこと、
 * 全画面で使用する共通のプロパティを付与する
 */
hlpr._ContentBase = (function () {
  var new_message_title = '新着メッセージがあります。';
  var new_message_html  = '<img class="new_icon_side_message" src="/images/icon_new_circle.png"/>';
  // トップ画面「マイページ」部分のnewマーク
  var top_new = '<div style="display: table-cell; vertical-align: middle; width: 25px;">'
              + '<img class="new_icon_index_message" src="/images/icon_new_circle.png" style="width: 20px !important;"/>'
              + '</div>';
  var top_new_after = '<div class="messageArea" style="padding-left: 50px;" >'
                    + '<p class="new_messageTextSmall">新着メッセージがあります。</p>'
                    + '</div>';

  function F () {

    if (_.isUndefined(this.viewer)) {
      this.viewer = window.location.pathname.match(/^\/\w+\/\w+/);
    }

    if (_.isUndefined(this.resource) && !_.isEmpty(this.viewer)) {
      this.resource = _.find(hlpr.resources.index, function(res) {
        return res.viewer == this.viewer;
      }, this);

      if (!_.isUndefined(this.resource)) {
        this.visibleFor = hlpr.utils.getVisibleFor(this.viewer, this.resource);
        if (_.isUndefined(this.visibleFor) && this.resource.resourceName == "special") {
          this.visibleFor = 2;
        }
      }
    }

    var onsuccess = function (data) {
      if (data.num_of_new_messages) {
        this.num_of_new_messages(true);
        this.new_messages_html(new_message_html);

        // トップページ
        var isTop = $('#top_message_area');
        if (!_.isEmpty(isTop)) {
          isTop.prepend(top_new);
          isTop.after(top_new_after);
        }

        // side menu
        var temp = '<li>' + this.new_messages_html() + '<a class="new_messageText" href="/info/message"><span style="color:#ff0000;">'
                 + new_message_title 
                 + '</span></a></li>';

        $("#sidemenu_top").before(temp);
      }
    }

    hlpr.utils.get('/api/messages/numofnewmessages', {}, onsuccess, undefined, this);
    this.user_status = ko.observable();
    this.is_login = ko.observable();
    this.num_of_new_messages = ko.observable(false);
    this.new_messages_html = ko.observable("");
  }
  return F;
}());

 function get_menu_parameter() {
  var res = new Object;
  var pair=location.search.substring(1).split('&');
  for(var i=0;pair[i];i++) {
    var kv = pair[i].split('=');
    res[kv[0]]=kv[1];
    return res.menu_id;
}

 }

