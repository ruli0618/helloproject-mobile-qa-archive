
/*--------------------------------------------------------------------------
	
	Script Name : Random Image Script
	Author : FIRSTSTEP - Motohiro Tani
	Author URL : https://www.1-firststep.com
	Create Date : 2017/06/06
	Version : 1.0
	Last Update : 2017/06/06
	
--------------------------------------------------------------------------*/


function random_image() {
	
	var image_ul   = document.getElementById( 'random-image' );
	var image_li   = image_ul.getElementsByTagName( 'li' );
	
	var random_int = Math.floor( Math.random() * image_li.length );
	
	image_li[random_int].style.display = 'block';
	
}




function addEventSet( element, listener, fn ) {
	try {
		element.addEventListener( listener, fn, false );
	} catch( e ) {
		element.attachEvent( 'on' + listener, fn );
	}
}

addEventSet( window, 'load', function() {
	random_image();
});