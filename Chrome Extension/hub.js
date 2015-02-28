if(typeof hub == 'undefined') var hub = {};
if("onhashchange" in window){
	window.onhashchange = function(){
		handleHashNav();
	}
}

// On load 
$(function(){
	// extend the hub object and set important properties
	$.extend(hub, {div:{}, mousePos:{doc:{}, caseQ:{}, pdf:{}},newDisc:{},$mouseBubble:{},bubbles:{}, ad:{}, materials:{}, currentMat:{}, nav:{}});
	
	hub.me.name = hub.me.first_name + ' ' + hub.me.last_name;
	hub.ad.div = $('#active_discussion_container');
	hub.ad.adr = $('#active_discussion_respond');
	hub.div.caseQ = $("#case_questions"); //case_questions > bubble_area > assignment_container
	hub.div.pdf = $("#pdfi_left");
	hub.bubbleHover = false;
	hub.isPDFImageLoaded = {count:0,i:[]};
	
	hub.activeDay = hub.today.mysqldate;
	
	// set tinymce editor
	setTextEditor();
	
	// set mouse position
	trackMousePosition(); 
	setDefaultBubblePositions(); 
	
	// set date pickr
	new Pikaday({
		field: $('#date_picker_cal_icon')[0],
		onSelect: function(){
			var selectedDate = this.getDate();
			changeCourseWeekWork(getSunday(selectedDate));
			var sdMYSQL = makeSQLDate(selectedDate);
			//selectAssignmentDate(sdMYSQL);
			changeHash(sdMYSQL + '/');
		}
	});
	
	PDFJS.workerSrc = 'assets/jscript/pdfjs/build/pdf.worker.js';
	handleHashNav();
	//console.log(hub);
});

function displayWeekRange(){
	var htmlStr = '';
	for(var i = 0; i < hub.weekRange.length; i++){
		var day = hub.weekRange[i];
		htmlStr += '<a name="' + day.mysqldate + '" href="#'+day.mysqldate+'/" class="date_item date_item_active" id="date-' 
		+ day.mysqldate + '" >' + day.day + '<br/>' + day.date + '</a>';
	}
	htmlStr += '<div class="clear"></div>';
	document.getElementById('date_picker_inner').innerHTML = htmlStr;
	setActiveDateLinks();
	$('#course_picker_container').hide();
}

// distinguish between active and inactive dates
function setActiveDateLinks(){
    $.each(hub.weekRange, function(i, d){
        hub.weekRange[i].assignmentCount = 0;
		// find out if there are courses for this date
        $.each(hub.assignments,function(key, a){
            if(a.date == d.mysqldate) {
                hub.weekRange[i].assignmentCount++;
            }
		});
		
		if(hub.weekRange[i].assignmentCount == 0){
			$('#date-' + d.mysqldate).toggleClass('date_item_inactive').toggleClass('date_item_active');
		}
	});
}


function changeCourseWeek(dir){
	var dateParts = hub.weekRange[0].mysqldate.split('-');
	var thisSunday = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
	
	var plusminus = (dir == -1)?-7:7;
	var startSunday = new Date(thisSunday.getFullYear(), thisSunday.getMonth(), thisSunday.getDate() + plusminus);
	changeCourseWeekWork(startSunday);
	$('#case_content').hide();
	//select first active 
	var actives = $('.date_item_active');
	if (actives.length){
		changeHash(actives[0].name + '/');
		//selectAssignmentDate(actives[0].name);
	}
	else{
		$('#no_content').hide().fadeIn(300);
	}
}

// change the week being displayed starting with loopday
function changeCourseWeekWork(loopDay){
	hub.weekRange = [];
	
	for(var i = 0; i < 7; i++){
		hub.weekRange[i] = {};
		hub.weekRange[i].mysqldate = makeSQLDate(loopDay);
		hub.weekRange[i].day = returnWeekDay(loopDay);
		hub.weekRange[i].date = returnFormattedDate(loopDay);
		loopDay = new Date(loopDay.getFullYear(), loopDay.getMonth(), loopDay.getDate() + 1);
	}
	
	displayWeekRange();
	$('#date_picker_inner').hide().fadeIn(300);
}

// when user selects an date expecting to receive assignemnts
function selectAssignmentDate(){
	var dStr = hub.nav.date;

    $('.date_item_selected').removeClass('date_item_selected');
    $('#date-'+dStr).addClass('date_item_selected');
	$('#case_content, #course_picker_container, #pdf_image_section, #no_content').hide();
	
	var cpHTML = '';
	$.each(hub.assignments,function(key, a){
		if(a.date == dStr){
			var slugTitle = convertToSlug(a.ass_title);
			var course = returnCourseDetailsByCID(a.course_id);
			var cDisplayName = (course.course_name.length > 25)?course.course_name_short:course.course_name;
			cpHTML += '<div class="course_icon"><a class="course_icon_a_' 
			+ a.ass_id + '" href="#' + hub.nav.date + '/' + a.ass_id 
			+ '/' + slugTitle + '">' + cDisplayName + '<span>' 
			+ a.ass_title + '</span></a></div>';
		}
	});
	
	if(cpHTML == '') cpHTML = '<div style="text-align:center;"><img src="assets/images/no_assignments.png" /></div>';
	cpHTML += '<div class="clear"></div>'
	$('#course_picker_container').html(cpHTML).slideDown(300);
}

// returns course details by course instance ID
function returnCourseDetailsByCID(id){
	var retCourse = null;
	$.each(hub.courses, function(key, c){
		if(c.course_id.toString() == id.toString()) retCourse = c;
		return true;
	});
	return retCourse;
}

// displays course content - assignment text and materials
function showCaseContent(){
	var assID = hub.currentAssID = hub.nav.assID;
	$('.course_icon a').attr('id','');
	$('.course_icon a.course_icon_a_'+hub.currentAssID).attr('id','course_icon_selected');
	
	var assignment = returnAssignmentDetails(assID);

	$('#assignment_container').html(assignment.ass_text);
	$('#case_link_container').html('');
	
	var caseContent = $('#case_content');
	caseContent.show();
	$('#pdf_image_section').hide();
	
	//set the width and height based on current assignement dimensions
	//this is done here because of the slideDown that confuses code later when height is needed
	hub.div.caseQ.assignedWidth = hub.div.caseQ.innerWidth();
	hub.div.caseQ.assignedHeight = hub.div.caseQ.innerHeight();
	
	//remove previously loaded bubbles
	$('.loaded_circle, .new_circle').remove();
	
	// get assignment materials
	$.ajax({
		url: "process",
		data: {req:'get_materials', ass_id:assID, process:'content'}
	}).done(function(data){
		if(data != '') displayMaterials(data);
	});
	
	// get assignmnet comments
	$.ajax({
		url: "process",
		data: {req:'get_assignment_comments', ass_id:assID, process:'content'}
	}).done(function(data){
		if(data != '') displayAssignmentComments(data);
	});
	
    caseContent.hide().slideDown(300,function(){});
}

function returnAssignmentDetails(assID){
	var retA = null;
	$.each(hub.assignments, function(key, a){
		if(a.ass_id == assID) retA = a;
		return true;
	});
	return retA;
}

// display materials after assignment has been selected
function displayMaterials(mStr){
	var linkHTML = '';
	var mArray = $.parseJSON(mStr);

	$.each(mArray, function(key, m){
		hub.materials[m.material_id] = m;
		hub.materials[m.material_id].pdfSrc = 'files/assignments/' + m.ass_dir + '/' + m.file_name + '.' + m.file_type;
		
		if(m.file_type == 'pdf'){
			hub.materials[m.material_id].pngDir = 'files/assignments/' + m.ass_dir + '/' + m.file_name + '/';
			var linkAttr = 'onclick="handlePDFasPNG(\'' + m.material_id + '\')" href="javascript:void(0)"';
		}
		else{
			var linkAttr = 'href="'+m.orig_src+'" target="_blank"';
		}
		linkHTML += '<a '+ linkAttr +' ><img src="assets/images/icons/'+returnIcon(m.file_type)+'" />'+m.title+'</a>';
	});
	
	if(mArray.length == 0) linkHTML = '<img src="assets/images/no_materials.png" />';
	$('#case_link_container').html(linkHTML);
}

function handlePDFasPNG(mid){
	hub.isPDFImageLoaded.i = [];
	hub.isPDFImageLoaded.count = 0;
	hub.isPDFImageLoaded.count = 0;
	
	$('#pdf_title').html(hub.materials[mid].title);
	$('#pdf_loader').show();
	$('#pdf_content').hide();
	
	// pdfImageSection contains left and right
	var pdfImageSection = $('#pdf_image_section');
	// hide but maintain container height
	pdfImageSection.show().css('visibility','hidden');
	
	// slide user down to this pdf image section then fade in slowly
	$('body').animate({scrollTop: pdfImageSection.offset().top - 10}, 500, function(){
		pdfImageSection.css({'visibility':'visible'});

			var intervalID = setInterval(function(){
				// this is used to display and save bubbles
				if(hub.isPDFImageLoaded.i[1]){
					$('#pdf_content').show();
					$('#pdf_loader').hide();
					$('html, body').animate({scrollTop: pdfImageSection.offset().top - 10});
					hub.div.pdf.assignedWidth = hub.div.pdf.innerWidth();
					hub.div.pdf.assignedHeight = hub.div.pdf.innerHeight();
					displayPDFComments();
					clearInterval(intervalID);
				}
			}, 300);
	});
	
	if(hub.materials[mid].is_png_set == '1'){
		displayPDFasPNG(mid);
	}
	else{
		getNewPDF(mid);
	}
}


// When a PDF material link is clicked 
function displayPDFasPNG(mid, dataSrc){
	hub.currentMat.pageNum = 1;
	hub.currentMat.mid = mid;
	// set up page 1
	// main image. normally page 1
	var imgSrc = (dataSrc == null)?hub.materials[mid].pngDir + '1.png': dataSrc;
	showThisPngPage(imgSrc, 1);
	
	
	// set up side nav menu
	var thumbStr = '';
	for(var i = 0; i < hub.materials[mid].page_count; i++){
		var pageNum = (i+1);
		thumbStr += '<a href="javascript:void(0)" id="pdfi_right_' + pageNum
		+ '" onclick="showThisPngPage(\'' 
		+ hub.materials[mid].pngDir + pageNum +'.png\', ' + pageNum 
		+ ')"><img src="assets/images/empty.png" class="pdf_thumb_loader" /><span>'
		+ pageNum+'</span></a>';
		
		setPDFThumb(mid, pageNum);
	}
	
	$('#pdfi_right').html(thumbStr);
}

function setPDFThumb(mid, pageNum){
	var thumbSrc = hub.materials[mid].pngDir + pageNum + '.png';
	$("<img/>").load(function(){
		hub.isPDFImageLoaded.count++;
		$('#pdfi_right_' + pageNum + ' img').attr('src', thumbSrc).attr('class','pdf_thumb');
		hub.isPDFImageLoaded.i[pageNum] = true;
	}).attr("src", thumbSrc);	
}


function showThisPngPage(src, pageNum){
	hub.div.pdf.find('img.pdf_image').attr('src',src).hide().fadeIn(200);
	hub.currentMat.pageNum = pageNum;
	displayPDFComments();
}

function displayPDFComments(){
	hub.div.pdf.find('.circle').remove();
	$.each(hub.bubbles, function(i,c){
		if(c.material_id == hub.currentMat.mid && c.target_page == hub.currentMat.pageNum){
			insertCommentBubble(c);
		}
	});
}

function getNewPDF(mid){
	var pdfSrc = hub.materials[mid].pdfSrc;

	PDFJS.getDocument(pdfSrc).then(function(pdf) {
		var pageCount = pdf.numPages;
		hub.materials[mid].page_count = pageCount;
		//save page count
		$.ajax({
            type:'POST',
            url:'process',
            data: {count:pageCount, mid:mid, process:'image_conversion', action:'saveTotalPages'}
        }).done(function(data){});

		for(i = 0; i < pageCount; i++){
			var currentPageNum = i + 1;
			
			pdf.getPage(currentPageNum).then(function(page){
				var scale = 1.4;
				var viewport = page.getViewport(scale);
				var canvas = createBlankCanvas(viewport.width, viewport.height);
				var context = canvas.getContext('2d');
				
				var renderContext = {
					canvasContext: context,
					viewport: viewport
				};
				
				var pageNumber = page.pageNumber;

				page.render(renderContext).then(function(){
					var pdfStream = canvas.toDataURL("image/png");
					
					// if this is the first page, then display it
					if(pageNumber == 1){
						hub.isPDFImageLoaded.i[1] = true;
						displayPDFasPNG(mid, pdfStream);
					}
					
					delete canvas;
					
					// save PDF image
					$.ajax({
						type:'POST',
						url:'process',
						data: {action:'savePNGImage', png:pdfStream, pageNumber:pageNumber, pageCount:pageCount, mid:mid, process:'image_conversion'}
					}).done(function(data){
						var retObj = $.parseJSON(data);
						if(retObj[0] && retObj[1] == mid){
							setPDFThumb(mid, retObj[2]);
						}
					});
				});
			});
		}
	});
}

function handlePDFPage(page){
	
}

function loadProgress(progress){
	var percentLoaded = progress.loaded / progress.total;
	m.status = percentLoaded + '% loaded';
}

function createBlankCanvas(width, height) {
    var c = document.createElement('canvas');
    c.setAttribute('width', width);
    c.setAttribute('height', height);
    return c;
}

// display comments after assignment has been selected
function displayAssignmentComments(cStr){
	var cArray = $.parseJSON(cStr);
	if(cArray[0]){
		$.each(cArray[1], function(key, c){
			insertCommentBubble(c);
		});
	}
}

// insert comments bubble. called from multiple locations
function insertCommentBubble(c){
	var $ct = $('#circle_template');
	var loadedBubble = $('<a class="circle loaded_circle"></a>');
	loadedBubble.attr('id', c.comment_id);
	
	loadedBubble.click(showBubbleDiscussion);
	loadedBubble.hover(showBubblePreview, hideBubblePreview);
	loadedBubble.css('z-index',0);
	
	var bubblePreview = returnBubblePreview(c);
	loadedBubble.append(bubblePreview);
	
	// determine where to place the bubbles relative it's container
	var pos = {};
	if(c.material_id == null){
		pos.left = c.pos_x * hub.div.caseQ.assignedWidth;
		pos.top = c.pos_y * hub.div.caseQ.assignedHeight;
		$('#case_questions').append(loadedBubble);
	}
	else{
		pos.left = c.pos_x * hub.div.pdf.assignedWidth;
		pos.top = c.pos_y * hub.div.pdf.assignedHeight;
		hub.div.pdf.append(loadedBubble);
	}
	
	loadedBubble.css('left', pos.left + 'px');
	loadedBubble.css('top', pos.top + 'px');
}

function returnBubblePreview(c){
	var bPreview = $($('#bubble_preview')[0].outerHTML).attr('id','bubble_preview_' + c.id);
	bPreview.attr('class', bPreview.attr('class') + ' bubble_preview_added');
	bPreview.find('.preview_user_name').html(c.name + ':');
	bPreview.find('.preview_title').html(c.title);
	bPreview.find('.preview_details').html(c.date + ' at ' + c.time);
	bPreview.find('.preview_user_img').attr('src', 'files/user_images/'+c.user.user_id+'.jpg');
	c.like_count = isNumber(c.like_count)?c.like_count:0;
	c.r_count = isNumber(c.r_count)?c.r_count:0;
	bPreview.find('.preview_vote_count span').html(c.like_count);
	bPreview.find('.preview_post_count span').html(c.r_count);
	hub.bubbles[c.id] = c;
	return bPreview;
}




/* discussion form section */

// first create new bubble and position it correctly based on mouse position
function addNewBubble(locType){
	if(!hub.bubbleHover){
		hub.newDisc.id = returnRandomID(8);
		hub.newDisc.locType = locType;
		var newCircle = $($('#circle_template')[0].outerHTML);
		newCircle.attr('id', hub.newDisc.id);
		newCircle.attr('class', newCircle.attr('class') + ' new_circle');
		
		hub.div[locType].append(newCircle);
		newCircle.show();
		
		var adjust = newCircle.height()/2;
		
		hub.newDisc.bubbleLeft = (hub.mousePos[locType].left - adjust);
		hub.newDisc.bubbleTop = (hub.mousePos[locType].top - adjust);
		
		newCircle.css('left', hub.newDisc.bubbleLeft + 'px');
		newCircle.css('top', hub.newDisc.bubbleTop + 'px');
		
		hub.newDisc.x = hub.newDisc.bubbleLeft / hub.div[locType].innerWidth();
		hub.newDisc.y = hub.newDisc.bubbleTop / hub.div[locType].innerHeight();
		
		showNewDiscussionForm(hub.newDisc.id);
	}
}

// then show the new discussion form
function showNewDiscussionForm(circleID){
	var ct = $('#'+circleID);
	var dt = $('#disc_template');
	
	parentLeft = ct.parent().offset().left - $(window).scrollLeft();
	parentWidth = ct.parent().innerWidth();
	
	var newLeft = parentLeft + parentWidth/2 - dt.outerWidth()/2;
	
	$('#disc_template').css({'top':(hub.mousePos.doc.top) + 'px', 'left': (newLeft) + 'px'}).fadeIn(300, function(){
		$('#disc_title_input').focus();
	});
	ct.css('z-index',13);
	showGeneralOverlay(hideNewDisc);
}

// cancel new discussion
function hideNewDisc(){
	$('#disc_template, #general_overlay').fadeOut(200);
	$('#general_overlay').unbind('click');
	$('#'+hub.newDisc.id).remove();
}

function saveNewDiscussion(){
	if(confirm('Are you sure you want to save this discussion?')){
		// create b object. why b? good question
		var b = {};
		b.orig_id = hub.newDisc.id;
		b.title = $('#disc_title_input').val();
		b.text = tinyMCE.get('disctext').getContent();
		b.user = hub.me;
		b.x = hub.newDisc.x;
		b.y = hub.newDisc.y;
		
		// currentMat has mid and page num for pdfs
		if(hub.newDisc.locType == 'pdf'){
			$.extend(b, hub.currentMat);
		}
		
		//might wanna add some loaders or something
		$('#disc_template_inner').css('visibility','hidden');
		$('#disc_template_loader').show();
		
		$.ajax({
			type:'POST',
			url: 'process',
			data:{comment:JSON.stringify(b), req:'save_comment', ass_id:hub.currentAssID, process:'content'}
		}).done(handleSavedDiscussion);
	}
}

// set up the bubble
function handleSavedDiscussion(data){
	var rArray = $.parseJSON(data);
	if(rArray[0]){
		var r = rArray[1];

		hub.newDisc.id = r.id; // new bubble id set in php
		hub.bubbles[r.id] = r;
		
		var bubbleDiv = $('#'+r.orig_id);
		var bPreview = returnBubblePreview(r);
		bubbleDiv.attr('id', r.id);
		bubbleDiv.append(bPreview);
		bubbleDiv.click(showBubbleDiscussion);
		bubbleDiv.hover(showBubblePreview, hideBubblePreview);

		bubbleDiv.css('z-index',0);
		
		tinyMCE.get('disctext').setContent('');
		$('#disc_template_loader').hide();
		$('#disc_template_confirm').fadeIn(300);
		
		setTimeout(function(){
			closeWindowAndOverlay($('#disc_template'));
			$('#disc_template_inner').css('visibility','hide');
			$('#disc_template_confirm').hide();
		}, 1000);
	}
}

// when you hover over a bubble, show preview
function showBubblePreview(){
	hub.bubbleHover = true;
	
	$(this).animate({backgroundColor:'rgba(14,94,155,.2)',borderColor:'#5786a9'},300);
	$(this).css('z-index',5);
	$(this).find('.bubble_preview').show();
}

// when you hover out of bubble, hide preview
function hideBubblePreview(){
	hub.bubbleHover = false;
	$(this).animate({backgroundColor:'rgba(186,83,80,.1)',borderColor:'rgba(155,60,57,0.3)'},300);
	
	$(this).css('z-index',0);
	$(this).find('.bubble_preview').fadeOut(300);
}

/* display discussion: very important */
/* display discussion: very important */

function showBubbleDiscussion(){
	hub.ad.cid = this.id;
	
	var topAD = $('#active_discussion_top');
	var st = showGeneralOverlay(hideActiveDiscussion);
	var c = hub.bubbles[this.id];
	hub.ad.div.find('.active_discussion_title').html(c.title);
	
	var rowTemplateHTML = $('#ad_row_template').html();
	topAD.html('<div class="active_discussion_row">' + rowTemplateHTML + '</div>');
	topAD.find('.ad_row_body').html(c.text);
	topAD.find('.ad_row_meta_name').html(c.user.name);
	topAD.find('.ad_row_meta_ts').html('Posted: ' + c.date + ' at ' + c.time);
	topAD.find('.ad_row_meta_img').attr('src','files/user_images/' + c.user.user_id + '.jpg');
	
	// handle votes/likes
	handleDiscussionVote(c, topAD);
	
	//keep everything hidden until
	getDiscussionResponses(c.id);

	$('#ad_loader').show();
	$('#ad_inner').css('visibility','hidden');
	hub.ad.adr.css('visibility','hidden');
	
	hub.ad.div.css('top', st + 100);
	hub.ad.adr.hide();
	hub.ad.div.fadeIn(300, function(){
		setADRespondPosition();
		hub.ad.adr.show();
	});
	$('.bubble_preview').hide();
}

function handleDiscussionVote(c, rowContainer){
    c.like_count = isNumber(c.like_count)?c.like_count:0;
	
	rowContainer.find('.ad_row_vote_count').html(c.like_count);
	
	rowContainer.find('.ad_row_voteup_selected').attr('class', 'ad_row_voteup');
	rowContainer.find('.ad_row_votedown_selected').attr('class', 'ad_row_votedown');
	
	if(c.isLikedByMe){
		// highlight the arrow based on your vote direction
		if(c.myVoteDirection == '1'){
			rowContainer.find('.ad_row_voteup').attr('class', 'ad_row_voteup_selected');
		}
		else{
			rowContainer.find('.ad_row_votedown').attr('class', 'ad_row_votedown_selected');
		}
	}
	
	//determine whether it's a comment or a response
	var idObj = {cid:null, rid:null};
	if(c.rowType == 'comment'){
		idObj.cid = c.id;
	}
	else{
		idObj.rid = c.id;
	}

	rowContainer.find('.ad_row_voteup, .ad_row_votedown, .ad_row_votedown_selected, .ad_row_voteup_selected').click(function(){
		likeBubbleDiscussion(idObj, this);
	});
}

// get discussion responses from database
function getDiscussionResponses(cid){
	$.ajax({
		url: "process",
		data:{cid:cid, req:'get_comment_responses', process:'content'}
	}).done(function(data){
		var rArray = $.parseJSON(data);
		if(rArray[0]){
			$('#ad_responses').html('');
			$.each(rArray[1], function(key, r){
				insertADResponse(r);
			});
			updateResponseCount();
			
			// let a loader load
			setTimeout(function(){
				$('#ad_loader').hide();
				$('#ad_inner').css({visibility:'visible',opacity: 0}).animate({opacity: 1},300);
				hub.ad.adr.css({visibility:'visible',opacity: 0}).animate({opacity: 1},300);
			}, 500);
		}
	});
}

// save active discussion response
function saveADResponse(){
	var r = {};
	r.text = tinyMCE.get('adrespond').getContent();
	r.cid = hub.ad.cid;
	
	$.ajax({
		type:'POST',
		url: 'process',
		data: {r:JSON.stringify(r), req:'save_comment_response', process:'content'}
	}).done(function(data){
		var rArray = $.parseJSON(data);
		if(rArray[0]){
			var r = rArray[1];
			insertADResponse(r);
			hideADRespondForm();
			tinyMCE.get('adrespond').setContent('');
			updateResponseCount();
		}
	});
}

// insert active discussion response row
function insertADResponse(r){
	var rContainer = $('#ad_responses');
	//var oe = isEven(rContainer.find('.active_discussion_row').length)?'even':'';
	var newRow = $('<div class="active_discussion_row">' + $('#ad_row_template').html() + '</div>');
	
	newRow.find('.ad_row_body').html(r.text);
	newRow.find('.hidden_adrow_id').html(r.id);

	newRow.find('.ad_row_meta_name').html(r.user.name);
	newRow.find('.ad_row_meta_ts').html('Posted: ' + r.date + ' at ' + r.time);
	newRow.find('.ad_row_meta_img').attr('src','files/user_images/'+r.user.user_id+'.jpg');

	rContainer.append(newRow);
	
	handleDiscussionVote(r, newRow);
}



/* active discussion respond form section */

function showADRespondForm(){
	$('#ad_respond_button').hide();
	$('#active_discussion_respond_2').show();
	hub.ad.div.animate({'padding-bottom':hub.ad.adr.outerHeight()}, 300, function(){
		tinyMCE.get('adrespond').getBody().focus();
	});
}

function hideADRespondForm(){
	$('#ad_respond_button').show();
	$('#active_discussion_respond_2').hide();
	hub.ad.adr.hide();
	hub.ad.div.animate({'padding-bottom':hub.ad.adr.outerHeight()}, 300, function(){
		hub.ad.adr.css('top',(hub.ad.div.innerHeight() - hub.ad.adr.outerHeight()));
		hub.ad.adr.fadeIn(100);
	});
}

function updateResponseCount(){
	var count = $('#ad_responses .active_discussion_row').length;
	var end = (count == 1)?'response':'responses';
	var str = '<span>' + count + '</span> ' + end;
	$('#ad_response_count').html(str);
}

function setADRespondPosition(){
	hub.ad.div.css('padding-bottom',hub.ad.adr.outerHeight());
	hub.ad.adr.css('top',(hub.ad.div.innerHeight() - hub.ad.adr.outerHeight()));
}

//vote up ro down on a comment or response
function likeBubbleDiscussion(likeObj, me){
	likeObj.direction = 0;
	if(me.className == 'ad_row_voteup'){
		likeObj.direction = 1;
	}
	else if(me.className == 'ad_row_votedown'){
		likeObj.direction = -1;
	}
	
	$.ajax({
		url: "process",
		data: {req:'save_comment_like', like:JSON.stringify(likeObj), process:'content'},
		type:'POST'
	}).done(function(data){
		var rArray = $.parseJSON(data);
		if(rArray[0]){
		}
	});
	
	var plus = {};
	plus.previousCount = {};
	plus.previousCount.up = $(me).parent().find('.ad_row_voteup_selected').length;
	plus.previousCount.down = $(me).parent().find('.ad_row_votedown_selected').length;
	plus.val = likeObj.direction;
	
	$(me).parent().find('.ad_row_voteup_selected').attr('class','ad_row_voteup');
	$(me).parent().find('.ad_row_votedown_selected').attr('class','ad_row_votedown');
	
	if(likeObj.direction != 0) $(me).attr('class',$(me).attr('class') + '_selected');
	
	// if user is canceling his vote
	if(likeObj.direction == 0){
		//if he previously voted up then subtract by 1
		plus.val = (plus.previousCount.up > 0)?-1:1; //flip it
	}
	else if((plus.previousCount.up + plus.previousCount.down) > 0){ // if user is changing votes
		plus.val = plus.val * 2;
	}
	
	var countDiv = $(me).parent().find('.ad_row_vote_count');
	countDiv.html(parseInt(countDiv.html()) + plus.val).hide().fadeIn(300);
}

// hide discussion that's alread saved, and stuff
function hideActiveDiscussion(){
	hub.ad.cid = null; 
	hideADRespondForm();
	hub.ad.div.hide();
	$('#general_overlay').unbind('click').hide();
}

// set tinymce text editor
function setTextEditor(){
	tinymce.init({
		skin : 'custom-light',
		statusbar: false,
		selector: "textarea#disctext",
		menubar : false,
		toolbar: "bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent"
	});
	
	tinymce.init({
		skin : 'custom-light',
		statusbar: false,
		selector: "textarea#adrespond",
		menubar : false,
		toolbar: "bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent"
	});	
}

// set the default bubble areas
function setDefaultBubblePositions(){
	$('.bubble_area').click(function(){
		addNewBubble('caseQ');
	});
	
	$('.bubble_area_png').click(function(){
		addNewBubble('pdf');
	});
}

// track mouse positions 
function trackMousePosition(){
	$(document).mousemove(function(e){
		hub.mousePos.caseQ.left = e.pageX - hub.div.caseQ.offset().left;
		hub.mousePos.caseQ.top = e.pageY - hub.div.caseQ.offset().top;
		
		hub.mousePos.pdf.left = e.pageX - hub.div.pdf.offset().left;
		hub.mousePos.pdf.top = e.pageY - hub.div.pdf.offset().top;
		
		hub.mousePos.doc.left = e.pageX;
		hub.mousePos.doc.top = e.pageY;
		/*
		hub.$mouseBubble.css('left', hub.mousePos.doc.left - hub.$mouseBubble.width()/2);
		hub.$mouseBubble.css('top', hub.mousePos.doc.top - hub.$mouseBubble.height()/2);
		*/
	});
}

function bubblePulse(val, speed){
	var rad = val/2;
	hub.$mouseBubble.animate({
		borderTopLeftRadius: rad, 
		borderTopRightRadius: rad, 
		borderBottomLeftRadius: rad, 
		borderBottomRightRadius: rad,
		WebkitBorderTopLeftRadius: rad, 
		WebkitBorderTopRightRadius: rad, 
		WebkitBorderBottomLeftRadius: rad, 
		WebkitBorderBottomRightRadius: rad, 
		MozBorderRadius: rad,
		width: val,
		height: val
	}, speed);
}

function closeWindowAndOverlay(w){
	$(w).hide(300);
	$('#general_overlay').hide();
	$('#general_overlay').unbind('click');
}

function returnIcon(ext) {
	var ret = 'icon.png';
    if(ext == 'pdf'){
		ret = 'pdf.png';
	}
	else if(ext == 'xls' || ext == 'xlsx'){
		ret = 'excel.png';
	}
	else if(ext == 'doc' || ext == 'docx'){
		ret = 'word.png';
	}
	return ret;
}

function showGeneralOverlay(func){
	var go = $('#general_overlay');
	var st = $(document).scrollTop();
	go.height($(document).height() + st);
	go.click(func);
	go.show();
	return st;
}


function returnRandomID(num){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < num; i++ ) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}


function isEven(n) {
   return isNumber(n) && (n % 2 == 0);
}

function isOdd(n){
   return isNumber(n) && (Math.abs(n) % 2 == 1);
}

function isNumber(n){
   return n == parseFloat(n);
}

function getSunday(d) {
  var t = new Date(d);
  t.setDate(t.getDate() - t.getDay());
  return t;
}

function makeSQLDate(date1) {
  return date1.getFullYear() + '-' +
    (date1.getMonth() < 9 ? '0' : '') + (date1.getMonth()+1) + '-' +
    (date1.getDate() < 10 ? '0' : '') + date1.getDate();
}

function returnWeekDay(d){
	var weekDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	return weekDay[d.getDay()];
}

function returnFormattedDate(d){
    var curr_date = d.getDate();
    var curr_month = d.getMonth() + 1; //Months are zero based
    var curr_year = d.getFullYear();
    return (curr_month + "-" + curr_date + "-" + curr_year);
}

function convertToSlug(Text){
    return Text
        .toLowerCase()
        .replace(/ /g,'-')
        .replace(/[^\w-]+/g,'')
        .replace(/-{2,}/g,'-');
}

function handleHashNav(){
	setHashVars();
	// if there is no hash then make assignment date the current date
	if(hub.nav.fullHash == ''){
		changeHash(hub.activeDay + '/');
		return false;
	}
	
	if(hub.nav.hashSplit[0] != hub.nav.date){
		hub.nav.date = hub.nav.hashSplit[0];
		selectAssignmentDate();
	}
	
	if(hub.nav.len > 1 && hub.nav.hashSplit[1] != ''){
		hub.nav.assID = hub.nav.hashSplit[1];
		showCaseContent();
	}
	
	// 0 = date
	// 1 = assignment id
	// 2 = assigment title
	// 3 = material or comment_id
	// 4
}

function setHashVars(){
	hub.nav.fullHash = $.trim(location.hash.replace('#',''));
	hub.nav.hashSplit = hub.nav.fullHash.split('/');
	hub.nav.len = hub.nav.hashSplit.length;
}

function changeHash(str){
	 window.location.hash = '#' + str;
	/*if(history.pushState) {
		history.pushState(null, null, '#' + str);
	}
	else {
		location.hash = '#' + str;
	}
	*/
}