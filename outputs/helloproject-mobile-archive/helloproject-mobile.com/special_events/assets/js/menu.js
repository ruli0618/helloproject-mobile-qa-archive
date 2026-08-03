$(function(){
	$("#slide_menuBtn").click(function(){
		if(!$("#wrap").hasClass("open")){
			$("#slide_menu").fadeIn();
			$("#wrap").addClass("open");
			$("#content").on("click",menuOpenClose);
			$("#content").on('touchmove.noScroll', function(e) {
				e.preventDefault();
			});
		}else{
			$("#wrap").removeClass("open");
			$("#content").off("click",menuOpenClose);
			$("#slide_menu").fadeOut(function(){$(this).attr("style","");});
			$("#content").off('.noScroll');
		}
	});
	function menuOpenClose(e){
		var _this = $(this);
		$("#wrap").removeClass("open");
		$("#content").off('.noScroll');
		$("#content").off("click",menuOpenClose);
		e.preventDefault();
	}
});