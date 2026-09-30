hlpr._mangaList = (function() {
  var utils = hlpr.utils;
  var initProperty = {
    category: [],
    page: 0,
    previousPage: "",
    nextPage: "",
    menu_id: 0
  }

  var initCategory = {
    category_id: 0,
    category_title: "",
    category_content: "",
    contents: [],
    htmlContents: "",
    htmlTitle: "",
    htmlCategory: "",
    inputId: "",
    labelfor: ""
  }

  var categoryMapping = {
    category: {
      create: function(options) {
        return new categoryVm (options.data);
      }
    },
    ignore: ['error', 'is_login', 'user_status']
  }

  var categoryVm = function (data) {
    this.htmlContents = ko.observable();
    this.htmlTitle = ko.observable();
    this.htmlCategory = ko.observable();
    this.inputId = ko.observable();
    this.labelfor = ko.observable();
    ko.mapping.fromJS(data, {}, this);
  }

  // var openTag = '<div class="submit">';
  var openTag = '<table><tr>';
  // var closeTag = '</div><br><br><br>';
  var closeTag = '</tr></table>';
  // var arrowTag = '<a href="#" class="arrow sampleA"></a>';
  var arrowTag = '<td><div class="manga_arrow"></div></td>'
  var arrowTagDummy = '<div class="arrowDummy sample1-2Dummy"></div>';
  var dummyTag = '<p></p>';
  var newIcon = '<img src="/images/icon_new_circle.png" class="manga_new" style="width:25px;height:25px;z-index:2;box-shadow:0 0 0 0;margin-left:12%;"/>';

  function _loadCategoryData() {
    var onsuccess = function(data) {
      var params = utils.params();

      if (!data.error.status && !_.isEmpty(data.category)) {
        this.menu_id (data.category[0].menu_id);
        ko.mapping.fromJS(data, categoryMapping, this);
        // 前後ページの制御
        if (!_.isUndefined(params.page) && params.page != "1") {
          var prevPageParams = [["menu_id", this.menu_id()],
                                ["page", (params.page - 1)]];
          this.previousPage(this.viewer + utils.createUrlParams(prevPageParams, true));
        }
        if (data.hasNext) {
          var nextPageParams = [["menu_id", this.menu_id()],
                                ["page", (_.isUndefined(params.page) ? "2" : (Number(params.page) + 1))]];
          this.nextPage(this.viewer + utils.createUrlParams(nextPageParams, true));
        }

        _.forEach (this.category(), function (category, categoryIdx) {
          this.category()[categoryIdx].htmlTitle(category.category_content());
          this.category()[categoryIdx].htmlCategory(category.category_title());
          this.category()[categoryIdx].inputId("category_"+categoryIdx);
          this.category()[categoryIdx].labelfor("category_"+categoryIdx);
          var onsuccess2 = function(data) {
            if (data.error.status == false && !_.isEmpty(data.contents)) {
              var oneContentsArray = [];
              // 他ページ所なり、リリース日が古い方が先にくる
              _.forEach(_(data.contents).reverse().value(), function(item, index) {

                var detailUrl = this.viewer + "/detail?content_id=" + item.content_id
                              + "&menu_id=" + this.menu_id()
                              + "&category_id=" + this.category()[categoryIdx].category_id()
                              + "&idx=" + item.idx;
                var oneHtml = '<th>' + item.content_sub_title
                            + '<div class="image_text"> <div class="thumbnail img">'
                            + '<a href="' + detailUrl + '">'
                            + (item.is_new == "1" ? newIcon : '')
                            + '<img src="/images/thumbnail/' + item.content_id + '.jpg" alt="' + (index % 3 + 1) + '" width="80%" style="margin-top: 5px;">'
                            + '<div class="text1" style="margin-top: 5px;">' + parseInt(index+1)  + '</div>'
                            + '</a></div></div></th>'
                // var oneHtml = '<p>'
                //             + '<a href="' + detailUrl + '">'
                //             + (item.is_new == "1" ? newIcon : '')
                //             + '<img src="/images/thumbnail/' + item.content_id + '.jpg" alt="' + (index % 3 + 1) + '" width="80%" >'
                //             + '<br>' + item.content_sub_title
                //             + '</p></a>';
                //
                oneContentsArray.push(oneHtml);
              }, this);// end forEach

              var temp = _createContentsHtml(oneContentsArray);
              this.category()[categoryIdx].htmlContents(temp);
            }//end data.error.status == false
          }// end onsuccess
          var queryParams = {
            category_id: category.category_id(),
            pre_page: 50
          }

          hlpr.utils.query("GET", "/api/contents", queryParams, onsuccess2, undefined, this);
        }, this);

      } else {
        utils.showReload("データが取得できませんでした。<br>更新をして下さい。");
      }
    }

    var params = utils.params();
    this.page (_.isUndefined(params.page) ? 0 : params.page);
    this.menu_id(params.menu_id);
    var queryParams = {
      menu_id: this.menu_id(),
      page: params.page
    }

    utils.get("/api/category", queryParams, onsuccess, undefined, this);
  }

  /**
   * 3行毎に改行して次の行になるので、その為のHTML構築
   * +最後の行が3コンテンツに満たない場合にダミー要素も追加
   * arrowTagは、ダミーを加えないと、立て列の表示位置がずれる為
   */
  function _createContentsHtml(oneContentsArray) {
    var temp = "";

    var arrayLenght = oneContentsArray.length
    for (var i = 0; i < 3 - (arrayLenght % 3); i++) {
      oneContentsArray.push(dummyTag);
    }

    currentLength = oneContentsArray.length

    for (var i = 0; i < currentLength; i++) {
      if (i % 3 == 0) {
        temp += openTag;
      }
      temp += oneContentsArray[i];

      if (oneContentsArray[i] != dummyTag && i != arrayLenght - 1) {
        if(i % 3 != 2){
          temp += arrowTag;
        }
      } else {
        temp += arrowTagDummy;
      }

      if (i % 3 == 2) {
        temp += closeTag;
      }
    }

    return temp;
  }

  return {
    init:  function () {
      hlpr._ContentBase.call(this);
      ko.mapping.fromJS(initProperty, {}, this);

      _loadCategoryData.call(this);

      ko.applyBindings(this, document.getElementById("bindingContext"));
    },
    clickAnchor: function (nextPage, thisArg) {
      if (!_.isEmpty(nextPage)) {
        location.href = nextPage;
      }
    },
    accordionTag: function (elem, thisArg) {
      $(elem).toggleClass("active");
      $(elem).siblings("dt").removeClass("active");
      $(elem).next("dd").slideToggle();
      $(elem).next("dd").siblings("dd").slideUp();
    }
  }
}()).init();

