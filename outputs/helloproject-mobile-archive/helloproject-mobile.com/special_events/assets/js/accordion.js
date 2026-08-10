$(function(){
     
$(".accordion p").click(function(){
    $(this).next("ul").slideToggle();
    $(this).children("span").toggleClass("open");
}); 
 
$(".accordion dt").click(function(){
    $(this).next("dd").slideToggle();
    $(this).next("dd").siblings("dd").slideUp();
    $(this).toggleClass("open");    
    $(this).siblings("dt").removeClass("open");
});
 
});