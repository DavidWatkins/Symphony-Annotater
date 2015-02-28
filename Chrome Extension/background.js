//Toggle annotate
//Click somewhere
	//Get x and y
	//Open editor
	//Save edit add to json
//Toggle annotate
var currentAnnotation = {};
var hub = [];
hub.mousePos = [];
var circles = [];

function returnRandomID(num){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < num; i++ ) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

// first create new bubble and position it correctly based on mouse position
function addNewBubble(){
  console.log("TEST");
    var tempDisc = {};

		var newCircle = $("<div class=\"circle\"></div>");
    newCircle.attr('id', (tempDisc.id = returnRandomID(8)));
    $("#GENERAL_OVERLAY").append(newCircle);
    newCircle.show();

		var adjust = newCircle.height()/2;

    tempDisc.x = hub.mousePos.left - adjust;
    tempDisc.y = hub.mousePos.top - adjust;

		newCircle.css('left', tempDisc.x + 'px');
		newCircle.css('top', tempDisc.y + 'px');

		showNewDiscussionForm(tempDisc);
}

var disc_template = '<div id="disc_template" class="disc_container"><div id="disc_template_header">Ask a question or share your thoughts</div><div id="disc_template_inner"><div class="disc_row"><div class="row_title">Your question or shortened point</div><input type="text" id="disc_title_input" class="text" /><div class="field_descrip">Write a 1 line description of your post/question</div></div><div class="disc_row"><div class="row_title">Give a more detail</div><textarea id="disctext"></textarea></div><div id="disc_save_bottom"><div class="abutton"><a class="bbb" id="disc_save" onclick="saveNewDiscussion()" href="javascript:void(0)">Post</a></div><div class="save_button_description">Post your comments</div></div></div><a class="x" onclick="hideNewDisc()" href="javascript:void(0)"></a><div id="disc_template_loader" class="loader loader_3_box"></div><div id="disc_template_confirm" class="positive_confirm"></div></div>'

// then show the new discussion form
function showNewDiscussionForm(tempDisc){
	var ct = $('#'+tempDisc.id);
	var dt = $("#disc_template");


	parentLeft = ct.parent().offset().left - $(window).scrollLeft();
	parentWidth = ct.parent().innerWidth();

	var newLeft = parentLeft + parentWidth/2 - dt.outerWidth()/2;
  dt.css('top', (hub.mousePos.top) + 'px');
  dt.css('left', (newLeft) + 'px');
	$('#disc_title_input').focus();
	ct.css('z-index',13);
	//showGeneralOverlay(hideNewDisc);
}

// track mouse positions
function trackMousePosition(){
	$(document).mousemove(function(e){
		hub.mousePos.left = e.pageX;
		hub.mousePos.top = e.pageY;
	});
}

$(document).ready(function() {
  $("body").wrap("<div id=\"GENERAL_OVERLAY\"></div>");
  $("#GENERAL_OVERLAY").append(disc_template);
  //$("#disc_template").hide();
  trackMousePosition();
  $('#GENERAL_OVERLAY').click(new function(e) {
    addNewBubble();
  });
});
