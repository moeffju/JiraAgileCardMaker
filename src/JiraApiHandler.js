var JiraApiHandler = function(jiraUrl, listener) {
    var username = document.getElementById("username").value;
    var password = document.getElementById("password").value;
    this.jiraApi = new JiraApi(jiraUrl, true, username, password);
	this.baseUrl = jiraUrl;
	this.listener = listener;
	this.jiraMap = {};

	this.requested = false;
	this.expectedCallbacks = 0;
	this.callbacksReceived = 0;
};

// Interface method - requestIssues passing in an array of issue ids.
JiraApiHandler.prototype.requestIssues = function(issueIds) {
	if (!this.requested) {
		this.requested = true;
		this.requestJiras(issueIds);
		this.chosenIssues = issueIds;
	} else {
		throw new Error("You can only request issues once.");
	}
};

JiraApiHandler.prototype.requestJiras = function(jiraIds) {
	this.expectedCallbacks = 0;
	this.callbacksReceived = 0;
	for (var i = 0; i < jiraIds.length; i++) {
		this.expectedCallbacks++;
		this.requestJira(jiraIds[i]);
	}
};


JiraApiHandler.prototype.isParentLoaded = function (card) {
	if (card.parentIssueId) {
		return this.jiraMap[card.parentIssueId] != null;
	} else {
		return true;
	}
};

JiraApiHandler.prototype.parentsNotLoaded = function () {
	var parentsNotLoaded = [];
	for (var index in this.jiraMap) {
		var card = this.jiraMap[index];
		if (!this.isParentLoaded(card)) {
			parentsNotLoaded.push(card.parentIssueId);
		}
	}
	return parentsNotLoaded
};

JiraApiHandler.prototype.processCardsData = function(jiraData) {
	var jiraKeys = [];
	for (var i=0; i < jiraData.issues.length; i++) {
		jiraKeys.push(jiraData.issues[i].key);
	}
	this.listener.receiveJiraCallback(jiraKeys);
};

JiraApiHandler.prototype.processRapidBoardViews = function(jiraData) {
	this.listener.receiveRapidBoardViews(jiraData);
};

JiraApiHandler.prototype.processProjectData = function(jiraData) {
	this.listener.receiveProjectData(jiraData);
};

JiraApiHandler.prototype.processFixVersionsData = function(jiraData) {
	this.listener.receiveFixVersionsData(jiraData);
};

JiraApiHandler.prototype.processRapidBoardSprints = function(jiraData) {
	var callbackName = this.getCallbackName();
	var sprintIds = RapidBoardHandler.getOpenSprintsFromJSON(jiraData);
	if (sprintIds == undefined || sprintIds.length == 0) {
		alert("There appears to be no available data. You may need to login");
	} else {
        this.listener.receiveOpenRapidBoardSprints(sprintIds);
	}
};

JiraApiHandler.prototype.getRapidBoardSprint = function(viewId, sprintId) {
    var callbackName = this.getCallbackName();
    this.jiraApi.getGreenhopperSprint(function(data) {window[callbackName](data)}, viewId, sprintId);
}

JiraApiHandler.prototype.processRapidBoardSprint = function(jiraData) {
	var issues = RapidBoardHandler.getJirasFromJSON(jiraData);
	this.listener.receiveJiraCallback(issues);
}

JiraApiHandler.prototype.processXBoard = function(jiraData) {
    this.listener.receiveXBoardData(jiraData);
}

JiraApiHandler.prototype.processCardData = function(jiraData) {
this.callbacksReceived++;
	this.jiraMap[jiraData.key] = this.getCard(jiraData);
	if (this.callbacksReceived == this.expectedCallbacks) {
		this.renderCardsIfReady();
	}
};

JiraApiHandler.prototype.processJiraData = function(jiraData) {
	this.hideLoadingIndicator();
	if (jiraData.length == 0)
	{
		alert('No data was returned! Are there any Jiras in this bucket?');
	}
	if (jiraData.views != null) {
		this.processRapidBoardViews(jiraData);
	} else if (jiraData.sprints != null) {
		this.processRapidBoardSprints(jiraData);
	} else if (jiraData.contents != null) {
		this.processRapidBoardSprint(jiraData);
	} else if (jiraData.epicData != null) {
        this.processXBoard(jiraData);
    } else if (jiraData.views != null) {
        this.processXBoards(jiraData);
    } else if (jiraData.issues != null) {
        this.processCardsData(jiraData);
    } else if (jiraData.length != undefined && jiraData[0].self.indexOf("project") != -1) {
		console.log(jiraData[0])
		this.processProjectData(jiraData);
	} else if (jiraData.length != undefined && jiraData[0].self.indexOf("version") != -1) {
		this.processFixVersionsData(jiraData);
	} else {
		this.processCardData(jiraData);
		//console.log(jiraData);
		//throw "Data received from JiraAPI unrecognized";
	}
};

JiraApiHandler.prototype.getCard = function (jira) {
	var componentString = "";
	var components = jira.fields.components;
	if (components.length != 0) {
		var componentsString = "";
		for (var id in components) {
			componentsString += components[id].name + ",";
		}
		componentString = componentsString.substring(0, componentsString.length - 1) + ":";
	}
	var card = new Card(jira.key,
		this.baseUrl + "/browse/" + jira.key,
		jira.fields.issuetype.name,
		jira.fields["customfield_10243"],
		jira.fields.summary,
		componentString,
		jira.fields["customfield_10151"],
		jira.fields["customfield_10261"],
		jira.fields.parent ? jira.fields.parent.key : null
	);
	return card;
};

JiraApiHandler.prototype.renderCardsIfReady = function () {
	var parentsNotLoaded = this.parentsNotLoaded();
		this.requestJiras(parentsNotLoaded);
	if (parentsNotLoaded.length !== 0) {
	} else {
		this.listener.onIssuesAvailable(this.chosenIssues, this.jiraMap);
	}
};

JiraApiHandler.prototype.hideLoadingIndicator = function() {
	var li = document.getElementById("loading");
	li.style.display = "none";
	clearTimeout(timeoutCallback);
}

JiraApiHandler.prototype.showLoadingIndicator= function() {
	var li = document.getElementById("loading");
	li.style.display = "block";
	if (typeof timeoutCallback !== "undefined") {
		clearTimeout(timeoutCallback);
	}
	timeoutCallback = setTimeout(function() {
		alert("Haven't received any data in 5 seconds. Something may have failed");
	}, 5000);
}