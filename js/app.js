var ver = "1.2.6";
//设置通知永久音量。
document.getElementById('notification').volume = 0.4;
(function(){
  'use strict';
  angular
	.module('nullchat', ['ngMaterial', 'firebase', 
						 'ui.router', 'luegg.directives', 
						 'ngHolder', 'angularMoment', 'ngSanitize',
						 'ngFileUpload',
						 'angulartics', 'angulartics.google.analytics']
	)
	.run(['$rootScope', '$mdSidenav', function($rootScope, $mdSidenav) {
		$rootScope.$on('$stateChangeSuccess', 
		function(event, toState, toParams, fromState, fromParams){
				// console.log($mdSidenav('left').isOpen());
				// console.log($mdSidenav('left').isLockedOpen());
				if(toState.name == 'chat') {
					if(!$mdSidenav('left').isLockedOpen() && $mdSidenav('left').isOpen()) {
						$mdSidenav('left').close();
					}
				}
		})
		//启动应用程序运行时看。默认情况下也将启动存活服务。
    	// Idle.watch();
	}])
	.config(['$mdThemingProvider', '$mdIconProvider', '$urlRouterProvider', '$stateProvider', '$analyticsProvider', function($mdThemingProvider, $mdIconProvider, $urlRouterProvider, $stateProvider, $analyticsProvider){
		function loadApp(NCService) {
		  		return NCService.init();
		}
		loadApp.$inject = ['NCService'];
		$urlRouterProvider.otherwise("/");
		// 现在成立了国
		$stateProvider
		// .state('maint', {
		//   url: "/",
		//   // abstract : true,
		//   templateUrl: "views/maint.html", 
		//   // controller: 'NCController',
		//   // controllerAs : 'nc',
		//   // resolve : {
		//   // 	loadApp : loadApp
		//   // }
		// })
		.state('dashboard', {
		  url: "/",
		  // abstract : true,
		  templateUrl: "views/dashboard.html", 
		  // controller: 'NCController',
		  // controllerAs : 'nc',
		  resolve : {
		  	loadApp : loadApp
		  }
		})
		.state('chat', {
		  url: "/:chatId",
		  // parent: 'dashboard',
		  templateUrl: "views/chatbox.html",
		  controller: 'ChatBoxController',
		  controllerAs : 'cb', 
		  resolve : {
		  	loadApp : loadApp,	
		  	chatValid : ['NCService', '$stateParams', '$rootScope', function(NCService, $stateParams, $rootScope) {
		  		$rootScope.loadingActivity = true;
		  		return NCService.loadChatData($stateParams.chatId);
		  	}]
		  }
		});
		$mdIconProvider
		  .defaultIconSet("./assets/svg/avatars.svg", 128)
		  .icon("menu"       , "./assets/svg/menu.svg"        , 24)
		  .icon("share"      , "./assets/svg/share.svg"       , 24)
		  .icon("google_plus", "./assets/svg/google_plus.svg" , 512)
		  .icon("hangouts"   , "./assets/svg/hangouts.svg"    , 512)
		  .icon("twitter"    , "./assets/svg/twitter.svg"     , 512)
		  .icon("phone"      , "./assets/svg/phone.svg"       , 512);
		$mdThemingProvider.theme('default')
		  .primaryPalette('blue')
		  .accentPalette('teal');
        $analyticsProvider.firstPageview(true); /* 不使用$状态记录页面或 $route */
        $analyticsProvider.withAutoBase(true);  /* 记录完整路径 */
	}])
	//这个指令带来的向下滚动向上时infitinelty滚动。
	.directive('execOnScrollToTop', ['$timeout', function ($timeout) {
		return {
			restrict: 'A',
			link: function (scope, element, attrs) {
				var container = angular.element(element);
				var fn = scope.$eval(attrs.execOnScrollToTop);
				container.bind('scroll', function (e) {
					// console.log(e);
					if (e.target.scrollTop <= 0) {
						console.log('做这件事...');
						var hasNext = scope.$apply(fn);
						if(hasNext) {
							scope.scrollLoading = true;
							var prevHeight = element[0].scrollHeight;
							var listenerHeight = scope.$watch(function() {
								return element[0].scrollHeight;
							}, function(newValue, oldValue, scope) {
								if(newValue != oldValue) {
									element[0].scrollTop = element[0].scrollHeight - prevHeight;
									listenerHeight();
									$timeout(function() {
										scope.scrollLoading = false;
									})
								}
							});
						}
					}
				});
			}
		};
	}]);
})();
(function(){
  angular
       .module('nullchat')
       .controller('NCController', NCController )
       .controller('UserNameChangeController', UserNameChangeController )
       .controller('ChatDialogController', ChatDialogController )
       .controller('ChatBoxController', ChatBoxController );
  /**
   * 对角材质入门应用主控制器
   * @param $scope
   * @param $mdSidenav
   * @param avatarsService
   * @constructor
   */
  function NCController( NCService, $q, $scope, $sce, $rootScope, $window, $mdSidenav, $stateParams, $mdDialog) {
    var self = this;
    // $rootScope.loadingActivity = true;
    self.getUserName = getUserName;
    self.toggleList = toggleList;
    // var ref = .then(function() {
      // console.log('loaded nc');
    // });
    // self.data = $scope.data;
    // console.log($firebaseArray);
    // this.chats = NCService.loadAllChats();
    // NCService.loadData($scope);
    self.createChat = createChat;
    self.getChatList = getChatList;
    self.newMessageCount = newMessageCount;
    self.showNameDialog = showNameDialog; 
    self.showTotalUnreadCount = showTotalUnreadCount;
    self.chatLoaded = chatLoaded;
    self.getChatName = getChatName;
    var idle = new $window.Idle();
    // console.log(idle);
    idle.onAway = function() {
      // console.log('away'); 
      // NCService.changeTypingStatus(self.chatId, 'remove');
      if($stateParams.chatId) {
        NCService.setUserIdle(true, $stateParams.chatId)
      }
      // ;
    };
    idle.onAwayBack = function() {
      // console.log('awayBack'); 
      if($stateParams.chatId) {
        NCService.resetUnreadCount($stateParams.chatId);
        NCService.setUserIdle(false, $stateParams.chatId);
      }
    };
    idle.setAwayTimeout(5000);
    idle.start();
    /** Functions */
    function chatLoaded(chatId) {
      return NCService.isChatLoaded(chatId);
    }
    function showTotalUnreadCount() {
      var total = 0;
      angular.forEach($rootScope.chats, function(value, chatId){
        total += $rootScope.chats[chatId].unreadCount;
      });
      var title = '在线聊天';
      if(total>0){
        title = '('+total+') ' + title; 
      }
      return $sce.trustAsHtml(title);
    }
    function toggleList() {
        $mdSidenav('left').toggle();
    }
    function showNameDialog(ev) {
      $mdDialog.show({
        targetEvent: ev,
        templateUrl : "views/nameDialog.html",
        clickOutsideToClose : true,
        preserveScope : true,
        bindToController : true,
        controller: 'UserNameChangeController',
        controllerAs : 'nc',
      });
    }
    function createChat() {
      NCService.createChat();
    }
    function getChatList() {
      return NCService.getChatList();
    }
    function getUserName() {
      return NCService.getUser().name;
    }
    function newMessageCount(chatId) {
      if($stateParams.chatId === chatId) {
        return null;
      } else {
        return NCService.newMessageCount(chatId);
      }
    }
    function getChatName(chatId) {
      // console.log(NCService.getChat(chatId));
      if(NCService.getChat(chatId)) {
        return NCService.getChat(chatId).meta.name;
      } else {
        return chatId;
      }
    }
  }
  NCController.$inject = ['NCService', '$q', '$scope', '$sce', '$rootScope', '$window', '$mdSidenav', '$stateParams', '$mdDialog'];
  function UserNameChangeController(NCService, $mdDialog, $rootScope) {
    var self = this;
    self.userName = NCService.getUser().name;
    self.closeDialog = closeDialog;
    self.changeUserName = changeUserName;
    self.authUser = authUser;
    self.authState = NCService.getAuthState('google');
    self.logoutUser = logoutUser;
    self.showProfileImage = NCService.getUserSettings('showProfileImage');
    self.saveSettings = saveSettings;
    console.log(self.authState);
    function saveSettings() {
    }
    function closeDialog() {
      $mdDialog.cancel(); 
    }
    function changeUserName() {
      NCService.changeUserName(self.userName);
      $mdDialog.cancel(); 
    }
    function logoutUser() {
      NCService.logoutUser().then(function() {
        NCService.goHome();
        $mdDialog.cancel(); 
      });
    }
    function authUser(loginProvider) {
      // console.log('login');
        // if(loginProvider == 'github') {
          NCService.authUser(loginProvider).then(function() {
            NCService.goHome();
            self.closeDialog();
          }, function() {
            alert('登录失败!');
            self.closeDialog(); 
          });
        // }
      }
  }
  UserNameChangeController.$inject = ['NCService', '$mdDialog', '$rootScope'];
  function ChatDialogController(NCService, $stateParams, $mdDialog) {
    var self = this;
    self.chatId = $stateParams.chatId;
    self.chatName = NCService.getChat(self.chatId).meta.name;
    console.log(this);
    self.closeDialog = closeDialog;
    self.changeChatName = changeChatName;
    /** Functions */
    function changeChatName() {
      NCService.changeChatName(self.chatId, self.chatName);
      self.closeDialog();
    }
    function closeDialog() {
      $mdDialog.hide();
    }
  }
  ChatDialogController.$inject = ['NCService', '$stateParams', '$mdDialog'];
  function ChatBoxController(NCService, $timeout, $mdDialog, $stateParams, $rootScope, $q, chatValid, $state, $location, $window) {
      var self = this;
      self.chatId = $stateParams.chatId;
      self.uploadProgress = 0;
      if(chatValid == false) {
        NCService.leaveChat(self.chatId);
        $state.transitionTo('dashboard');
      }
      // var chatId = /
      $rootScope.loadingActivity = false;
      // if(chatValid == false) 
      self.chatValid = chatValid;
      self.sendChat = sendChat;
      self.getChatData = getChatData;
      self.showOwner = showOwner;
      self.changeTypingStatus = changeTypingStatus;
      self.showTypingStatus = showTypingStatus;
      self.genUserBg = genUserBg;
      self.leaveChat = leaveChat;
      self.showShareModal = showShareModal;
      self.resetUnreadCount = resetUnreadCount;
      self.removeFocus = removeFocus;
      self.uploadFile = uploadFile;
      self.handleKeyDown = handleKeyDown;
      self.openChatMenu = openChatMenu;
      self.renameChat = renameChat;
      self.isChatOwner = isChatOwner;
      self.imageSrc = imageSrc;
      self.handleScrollToTop = handleScrollToTop;
      self.holderThemes = [ 'sky', 'vine', 'lava', 'industrial', 'social' ];
      self.userBgColors = {};
      self.menuOriginatorEv = null;
      /** Functions */
      function handleScrollToTop() {
        // console.log("滚动到顶部...");
        return NCService.initChatData(self.chatId, true);
        // console.log(hasNext);
      }
      function isChatOwner() {
        return NCService.isChatOwner(self.chatId);
      }
      function openChatMenu($mdOpenMenu, ev) {
        self.menuOriginatorEv = ev;
        $mdOpenMenu(ev);
      }
      function renameChat() {
        $mdDialog.show({
          targetEvent: self.menuOriginatorEv,
          clickOutsideToClose: true,
          preserveScope : true,
          bindToController : true,
          templateUrl : "views/chatDialog.html",
          controller: 'ChatDialogController',
          controllerAs : 'cd',
       });
      }
      function resetUnreadCount(chatId) {
        NCService.resetUnreadCount(self.chatId);
      }
      function removeFocus() {
        document.getElementById('chatText').blur();
      }
      function uploadFile(file) {
        if(!file) {
          return;
        }
        self.uploadProgress = 10; //初始化进度圆
        NCService.uploadFile(file).then(
          function(resp) {
            console.log(resp.data);
            if(resp.data && resp.data.data && resp.data.data.link) {
              //切换到安全链接！
              NCService.appendArray(self.chatId, 'image', resp.data.data.link);
            }
            self.uploadProgress = 0;
          },
          function(resp) {
            console.log(resp);
            alert('图片上传失败');
            self.uploadProgress = 0;
          }, function (evt) {
            self.uploadProgress = parseInt(100.0 * evt.loaded / evt.total);
          }
        );
      }
      function imageSrc(url) {
        if(!url) {
          return url;
        }
        if(typeof URL == 'function') {
          var img_host = new URL(url).hostname;
          // console.log(img_host);
          if(img_host === 'i.imgur.com') {
            var newURL = url.replace('http://','https://');
            newURL = newURL.replace(/\.(jpg|png|gif|jpeg)$/i,'m.$1');
            return newURL;
          } else {
            return url;
          }
        } else {
          return url;
        }
      }
      function showShareModal() {
        alert = $mdDialog.alert({
          title: '分享',
          textContent: $location.absUrl(),
          ok: '确定'
        });
        $mdDialog
          .show( alert )
          .finally(function() {
            // alert = undefined;
          });
      }
      function genUserBg(uid) {
        if(self.userBgColors[uid] === undefined) {
          self.userBgColors[uid] = self.holderThemes.shift();
          self.holderThemes.push(self.userBgColors[uid]);
        }
        // console.log(self.userBgColors[uid]);
        return self.userBgColors[uid];
      }
      function loadUserInfo() {
        NCService.loadUserInfo(self.chatId);
      }
      function leaveChat() {
        NCService.leaveChat(self.chatId);
      }
      function sendChat() {
        //console.log(self.chatText);
        if(self.chatText) {
          NCService.appendArray(self.chatId, 'text', self.chatText);
          self.chatText = ""; 
          self.changeTypingStatus(self.chatId, 'remove');
        }
      }
      function handleKeyDown(e) {
        var self = this;
        // console.log(e);
        if(e.keyCode == 13 && !e.shiftKey) {
          self.sendChat();
          e.preventDefault();
        } 
      }
      function getChatData() {
        return NCService.getChatData(self.chatId);
      }
      function showOwner(uid) {
        return NCService.showOwner(self.chatId, uid);
      }
      function changeTypingStatus() {
        var action = 'add';
        if(!self.chatText) {
          action = 'remove';
        }
        NCService.changeTypingStatus(self.chatId, action);
      }
      function showTypingStatus() {
        return NCService.showTypingStatus(self.chatId);
      }
  }
  ChatBoxController.$inject = ['NCService', '$timeout', '$mdDialog', '$stateParams', '$rootScope', '$q', 'chatValid', '$state', '$location', '$window'];
})();
(function(){
  'use strict';
  angular.module('nullchat')
         .service('NCService', NCService);
  /**
   * 用户数据服务
   * 采用嵌入式，硬编码的数据模型;异步行为模拟
   * remote data service call(s).
   *
   * @returns {{loadAll: Function}}
   * @constructor
   */
  function NCService($q, $analytics, $firebaseArray, $firebaseObject, $firebaseAuth, $rootScope, $stateParams, $state, $mdToast, Upload){
    var states = { INIT: 0, RUNNING : 1, LOADED: 2 };
    // $rootScope.currentState == states.INIT;
    // Promise-based API
    return {
      syncObject : { user : null, users : {} , chats : {} },
      // syncObject : 
      uid : 0,
      // currentState : states.INIT,
      fbRef : null,
      authObj: null,
      chats : [],
      fbData : null, 
      metaUsers : {},
      userIdle : false, 
      // CHAT_STATUSES : { INIT : 0, IDLE: 1, TYPING: 2, },
      makeid : function(length) {
          var text = "";
          var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
          for( var i=0; i < length; i++ )
              text += possible.charAt(Math.floor(Math.random() * possible.length));
          return text;
      },
      initRootScope : function() {
        $rootScope.users = {};
        $rootScope.chats =  {};
      },
      authAnonymous : function(cb) {
        var self = this;
        self.fbRef.authAnonymously(cb);
      },
      // onAuthenticate : ,
      init : function(bindObj) {
        var self = this;
        var def = $q.defer();
        //初始化状态
        if($rootScope.currentState === undefined) {
          self.initRootScope();
          $rootScope.loadingActivity = true;
          $rootScope.currentState = states.INIT;
        }
        if($rootScope.currentState == states.LOADED) {
          def.resolve(self.fbRef);
          // return def.promise;;
        }
        if($rootScope.currentState == states.INIT) {
          $rootScope.currentState = states.RUNNING;
          self.fbRef = new Firebase("https://angular-cn.firebaseio.com/79/");
          self.authObj = $firebaseAuth(self.fbRef);
          self.authObj.$onAuth(function(authData) {
            console.log('登录了');
            // var self = this;
            // console.log(this);
            console.log(authData);
            if(authData) {
              //破坏上一页对象
              if(self.syncObject.user && self.syncObject.user.$value)
                self.syncObject.user.$destroy();
              // console.log($rootScope.chats);
              if(Object.keys($rootScope.chats).length) {
                for(var chatId in $rootScope.chats) {
                  if(self.syncObject.chats[chatId] && self.syncObject.chats[chatId].$value)
                    self.syncObject.chats[chatId].$destroy();
                }
              }
              self.uid = authData.uid;
              self.initData().then(function() {
                if(authData.provider === 'google') {
                  $rootScope.user.auth = authData.auth;
                }
                def.resolve(self.fbRef);
              });
            } else {
              console.log('登录改变，没有了UID');
            }
          });
          self.authObj.$waitForAuth().then(function(authData) {
            // console.log(authData);
            if(authData && authData.expires) {
              var d = new Date();
              var n = d.getTime();
              var sessionTimeout = authData.expires*1000;
              var remainingTime = (authData.expires*1000 - n)/60000;
            }
            if(!authData || remainingTime < 0) {
              // console.log('generating new UID');
              self.authAnonymous(function(error, authData) {
                if (error) {
                  console.log("登录失败!!!", error);
                } else {
                  console.log("有效载荷成功验证：", authData);
                  // self.uid = authData.uid;
                  // self.initData().then(function() {
                  //   def.resolve(self.fbRef);
                  // });
                }
              })
            } else {
              // self.uid = authData.uid;
              // console.log('already logged in');
              // self.initData().then(function() {
              //   def.resolve(self.fbRef);
              // });
            }
          })
        }
        return def.promise;
      },
      changeUserName : function(name) {
        name = name.trim();
        if(name && name.toUpperCase() != '你' 
            && name.toUpperCase() != 'ADMIN' 
            && name.toUpperCase().indexOf('FUCK') === -1) {
          $rootScope.user.meta.name =  name ;
        }
      },
      initStructUser : function() {
        var self = this;
        if($rootScope.user.meta === undefined) {
            $rootScope.user.meta = {};
            self.changeUserName("User " + self.makeid(5));
            // $rootScope.user.meta.name =  "User " + self.makeid() ;
        }
        if($rootScope.user.auth === undefined) {
            $rootScope.user.auth = {};
        }
        if($rootScope.user.settings === undefined) {
            $rootScope.user.settings = {};
        }
        if($rootScope.user.chats === undefined) {
            $rootScope.user.chats = { own : [], shared : [] };
        }
      },
      initData : function() {
        var self = this;
        var def = $q.defer();
        console.log(self.uid);
        if(self.syncObject.user && self.syncObject.user.$value)
            self.syncObject.user.$destroy();
        self.syncObject.user = $firebaseObject(self.fbRef.child('users').child(self.uid));
        self.syncObject.user.$bindTo($rootScope, "user");
        self.syncObject.user.$loaded(function(value) {
          console.log('user loaded ' + self.uid);
          //初始用户名和自己/共享列表
          self.initStructUser();
          $rootScope.loadingActivity = false;
          $rootScope.currentState = states.LOADED;
          def.resolve(self.fbRef);
        });
        return def.promise;
      },
      isNcdataInit: function() {
        // console.log('haan bhai');
        return $rootScope.user !== undefined;// && $rootScope.chats !== undefined;
      },
      initStructChat : function(chatId) {
        // if($rootScope.chat.data === undefined) {
        //   $rootScope.chat.data = [];
        // }
      },
      getUser : function() {
        var self = this;
        // console.log($rootScope.user);
        if(self.isNcdataInit()) {
          return { name: $rootScope.user.meta.name };
        } else {
          return { name: '' };
        }
      },
      createChat : function() {
        var self = this;
        var chatId = this.makeid(10);
        // console.log($rootScope.ncdata);
        if($rootScope.user.chats.own === undefined) {
         $rootScope.user.chats.own = [];
        }
        $rootScope.user.chats.own.push(chatId);
        //创建空的聊天对象
        // var chatEmptyObj = {};
        var chatEmptyObj = {
          meta : {
            name: chatId,
            created: Firebase.ServerValue.TIMESTAMP, 
            owner: self.uid,
          },
          data : {
            desc : "聊天数据",
            sharedWith : [],
            typing :  []
          },
          array : []
        };
        //console.log(chatEmptyObj);
        self.fbRef.child('chats').child(chatId).set(chatEmptyObj, function() {
          $analytics.eventTrack('chat-create', {  category: 'chat', label: chatId });
          $state.transitionTo('chat', { chatId : chatId});
        });
      },
      getChatList : function() {
        var self = this;
        if(self.isNcdataInit()) {
          // console.log($rootScope.ncdata.chats);
          return $rootScope.user.chats;
        }
        else
          return [];
      },
      // createIfNotCreated : function(obj) {
      //   if(obj === undefined) {
      //     $rootScope.user.chats.shared
      //   }
      // },
      showOwner : function(chatId, uid) {
        var self = this;
        // return self.uid + " " + uid;
        if(self.uid == uid)
          return  "你" ;
        else {
          // console.log($rootScope.users[uid]);
          if($rootScope.users[uid] !== undefined) {
            return $rootScope.users[uid].name;
          } else  {
            self.loadUserInfo(chatId);
            // return '';
          } 
          // console.log(self.getMetaUser(uid, 'name'));
        }
      },
      getCurTimestamp : function() {
        var d = new Date();
        return d.getTime();
      },
      changeTypingStatus : function(chatId, action) {
        var self = this;
        if($rootScope.chats[chatId].data.$value === null) {
          return;
        }
        if(self.isNcdataInit()) {
          if($rootScope.chats[chatId].data.typing === undefined || Array.isArray($rootScope.chats[chatId].data.typing)) {
            $rootScope.chats[chatId].data.typing = {};
          }
          if(($rootScope.chats[chatId].data.typing[self.uid] === undefined || $rootScope.chats[chatId].data.typing[self.uid] === false) && action == 'add') {
            // console.log('adding/updating..');
            $rootScope.chats[chatId].data.typing[self.uid] = self.getCurTimestamp();
          }
          if($rootScope.chats[chatId].data.typing[self.uid] !== undefined && action == 'remove') {
            // console.log('removing...');
            // console.log(chatId);
            $rootScope.chats[chatId].data.typing[self.uid] = false;
            //var index = $rootScope.chats[chatId].data.typing.indexOf(self.uid);
            // console.log(self.uid);
            // console.log(index);
            // console.log($rootScope.chats[chatId].data.typing);
            // $rootScope.chats[chatId].data.typing.splice(index, 1);
          }
        }
      },
      showTypingStatus : function(chatId) {
        var self = this;
        if(self.isNcdataInit()) {
          // return 'VIKAS';
          if($rootScope.chats[chatId].data.typing !== undefined) {
            // return $rootScope.ncdata.chat.typing;
            if(Object.keys($rootScope.chats[chatId].data.typing).length > 0 ) {
              self.typing = [];
              angular.forEach($rootScope.chats[chatId].data.typing, function(timestamp, uid){
                // console.log(uid);
                // console.log(self.getCurTimestamp() - timestamp);
                if(uid !== self.uid && (self.getCurTimestamp() - timestamp < 10000) ) {
                  if(self.showOwner(chatId, uid))
                    self.typing.push(self.showOwner(chatId, uid));
                }
              });
              if(self.typing.length > 1) {
                self.typing = self.typing.join(', ') + ' are typing';
              } else if(self.typing.length == 1) {
                self.typing = self.typing[0] + ' is typing';
              } else {
                self.typing = '';
              }
              return self.typing;
              // return "有人打字 ..";
            } else {
              return '';
            }
          }
        }
      },
      addUserToChat : function(chatId) {
        var self = this;
        var isJoined = false;
        //如果当前用户不拥有chatId然后将其添加到用户的 "shared" 列表
        // ... 并将其添加到 "shareWith" 阵列中的聊天数据。
        if($rootScope.chats[chatId].meta.owner !== self.uid) {
          if($rootScope.user.chats.shared === undefined) {
           $rootScope.user.chats.shared = [];
          }
          if($rootScope.user.chats.shared.indexOf(chatId) == -1) {
            isJoined = true;
            $rootScope.user.chats.shared.push(chatId);
          }
        } 
        // else {
        //   if($rootScope.user.chats.own.indexOf(chatId) == -1) {
        //     isJoined = true;
        //   }
        // }
        //加上本人或共享的家伙到列表
        if($rootScope.chats[chatId].data.sharedWith === undefined) {
         $rootScope.chats[chatId].data.sharedWith = {};
        }
        // if($rootScope.chat.sharedWith[self.uid] == undefined)
        $rootScope.chats[chatId].data.sharedWith[self.uid] = true;
        return isJoined;
      },
      isInit : function() {
        var def = $q.defer();
        var self = this;
        var removeCheck = $rootScope.$watch("currentState", function(currentState) {
          // console.log(a);
          // console.log(b);
          if(currentState == states.LOADED) {
            removeCheck();
            def.resolve();
          }
          //
        })
        // def.resolve();
        return def.promise;
      },
      destroyAFObj : function(AFObj) {
        if(AFObj && AFObj.$id) {
          AFObj.$destroy();
        }
      },
      initRootObj : function(rootObj, fieldID) {
        if(rootObj[fieldID] === undefined)
          rootObj[fieldID] = {};
      },
      loadUserInfo : function(chatId) {
        var self = this;
        // console.log(chatId);
        var sharedWith = $rootScope.chats[chatId].data.sharedWith;
        angular.forEach(sharedWith, function(value, uid){
          if($rootScope.users[uid] === undefined) {
            //初始化用户荟萃
            $rootScope.users[uid] = { name : '..' };
            // console.log(uid);
             // = 
            self.syncObject.users[uid] = $firebaseObject(self.fbRef.child('users').child(uid).child('meta'));
            self.syncObject.users[uid].$bindTo($rootScope, "users['" + uid + "']" );
            //负载META
            self.syncObject.users[uid].$loaded(function(value) {
              // console.log('user data loaded' + $rootScope.users[uid].name);
            });
            // $rootScope.users[uid] = 
            // self.fbRef.child('users').child(uid).child('meta').once("value", function(snapshot) {
            //   $rootScope.users[uid] = snapshot;
            //   console.log($rootScope.users[uid]);
            //   console.log(snapshot.child('name').val());
            // })
          }
        });
        // $rootScope.users
      },
      isChatLoaded: function(chatId) {
        var self = this;
        if(self.isNcdataInit()) {
          return $rootScope.chats[chatId] !== undefined && $rootScope.chats[chatId].meta !==undefined && $rootScope.chats[chatId].data !== undefined;
        } else {
          return false;
        }
      },
      newMessageCount : function(chatId) {
        if($rootScope.chats[chatId] !== undefined && $rootScope.chats[chatId].unreadCount !== undefined) {
          return $rootScope.chats[chatId].unreadCount;
        } else
          return '';
      },
      // showMessageNTransition : function() {
      // },
      // 
      freeChatMem : function(chatId) {
        var self = this;
        self.syncObject.chats[chatId].data.$destroy();
        self.syncObject.chats[chatId].meta.$destroy();
        $rootScope.chats[chatId].array.$destroy();
        // $rootScope.chats[chatId].meta.$destroy();
        // $rootScope.chats[chatId].array.$destroy();
      },
      leaveChat : function(chatId) {
        var self = this;
        var isChatOwner = false;
        if($rootScope.chats[chatId].meta === undefined) {
          $mdToast.show($mdToast.simple().position('top right').textContent('聊天未找到'));
          if($rootScope.user.chats.own.indexOf(chatId) != -1)
              $rootScope.user.chats.own.splice($rootScope.user.chats.own.indexOf(chatId), 1);
          return;
        } else {
          isChatOwner = $rootScope.chats[chatId].meta.owner === self.uid;
        }
        if(isChatOwner) {
          console.log('你是这个聊天的主人');
          self.fbRef.child('chats').child(chatId).remove(function() {
            console.log('deleted');
            self.freeChatMem(chatId);
            if($rootScope.user.chats.own.indexOf(chatId) != -1)
              $rootScope.user.chats.own.splice($rootScope.user.chats.own.indexOf(chatId), 1);
            $mdToast.show($mdToast.simple().position('top right').textContent('聊天室已删除!'));
            $state.transitionTo('dashboard');
          })
        } else {
          if($rootScope.chats[chatId].data.sharedWith !== undefined && $rootScope.chats[chatId].data.sharedWith[self.uid] !== undefined)
            delete $rootScope.chats[chatId].data.sharedWith[self.uid];
          if($rootScope.user.chats.shared.indexOf(chatId) != -1) {
            self.appendArray(chatId, 'status', 'left').then(function() {
              self.freeChatMem(chatId);
            });
            $rootScope.user.chats.shared.splice($rootScope.user.chats.shared.indexOf(chatId), 1);
          }
          $mdToast.show($mdToast.simple().position('top right').textContent('你是这个聊天中不再'));
          $state.transitionTo('dashboard');
        }
      },
      playNotification : function() {
        document.getElementById('notification').play();
      },
      resetUnreadCount : function(chatId) {
        $rootScope.chats[chatId].unreadCount = 0;
      },
      goHome : function() {
        $state.transitionTo('dashboard');
      },
      setUserIdle : function(isIdle, chatId) {
        var self = this;
        self.userIdle = isIdle;
        // if(isIdle == false && $rootScope.chats[chatId].unreadCount > 0) {
        //   console.log('seeting unreadCount');
        //   $rootScope.chats[chatId].unreadCount = 0;
        // }
      },
      initChatData : function(chatId, loadMore) {
        var self = this;
        // console.log('init Chat Data');
        var arrayLength = 200;
        if(loadMore) {
          var hasNext = self.syncObject.chats[chatId].arrayRef.scroll.hasNext();
          if(hasNext)
            self.syncObject.chats[chatId].arrayRef.scroll.next(arrayLength);
          // console.log(self.syncObject.chats[chatId].arrayRef.scroll.hasNext());
        } else {
      //第一次负荷！
          //添加用户聊天（共享聊天）
          var isJoined = self.addUserToChat(chatId);
          //创建一个特殊的滚动裁判
          self.syncObject.chats[chatId].arrayRef = new Firebase.util.Scroll(self.fbRef.child('chats').child(chatId).child("array"), 'invertedTimestamp');
          // 生成裁判同步阵列
          $rootScope.chats[chatId].array = $firebaseArray(self.syncObject.chats[chatId].arrayRef);
          // var pageCount = syncObject.chats[chatId].arrayRef.page.pageCount;
          // self.syncObject.chats[chatId].arrayRef.scroll.last(5, 10); 
          self.syncObject.chats[chatId].arrayRef.scroll.next(arrayLength);
          var hasNext = self.syncObject.chats[chatId].arrayRef.scroll.hasNext();
          $rootScope.chats[chatId].array.$loaded(function() {
            if(isJoined) {
              self.appendArray(chatId, 'status', '加入');
            }
            $rootScope.chats[chatId].array.$watch(function(eventObj, arrayItem) {
              // console.log(eventObj);
              if(eventObj.event === 'child_added') {
                if($stateParams.chatId !== undefined && ($stateParams.chatId !== chatId || self.userIdle == true )) {
                  var childAdded = $rootScope.chats[chatId].array.$getRecord(eventObj.key);
                  if(self.userIdle == true && childAdded.type && childAdded.type !== 'status') {
                    self.playNotification();
                  }
                  $rootScope.chats[chatId].unreadCount +=1;
                }
              }
            });
          })
        }
        // $rootScope.chats[chatId].array = $firebaseArray(self.fbRef.child('chats').child(chatId).child("array").limitToLast(arrayLength));
        // 存储阵列，方便裁判上的滚动空间
        // syncObject.chats[chatId].array.scroll.next(10);
        // if(!loadMore) { 
        // }
        return hasNext;
      },
      loadChatData : function(chatId) {
        var self = this;
        var def = $q.defer();
        // $rootScope.chats[chatId].unreadCount = 0;
        // console.log($rootScope.chats[chatId].data);
        if($rootScope.chats[chatId] !== undefined && $rootScope.chats[chatId].data !== undefined) {
          $rootScope.chats[chatId].unreadCount = 0;
          def.resolve(true);
          return def.promise;
        }
        // //加载数据
        // self.isInit().then(function() {
          self.initRootObj(self.syncObject.chats, chatId);
          self.initRootObj($rootScope.chats, chatId);
          // $rootScope.chats[chatId].unreadCount = 0;
          // if($rootScope.chats[chatId].unreadCount === undefined)
          $rootScope.chats[chatId].unreadCount = 0;
          self.syncObject.chats[chatId].data = $firebaseObject(self.fbRef.child('chats').child(chatId).child("data"));
          self.syncObject.chats[chatId].data.$bindTo($rootScope, "chats['" + chatId + "'].data" );
          //load META
          self.syncObject.chats[chatId].data.$loaded(function(value) {
            console.log('聊天数据加载');
            //console.log($rootScope.chats);
            if($rootScope.chats[chatId].data.desc !== undefined) {
              self.syncObject.chats[chatId].meta = $firebaseObject(self.fbRef.child('chats').child(chatId).child("meta"));
              // 
              self.syncObject.chats[chatId].meta.$bindTo($rootScope, "chats['" + chatId + "'].meta" );
              self.syncObject.chats[chatId].meta.$loaded(function(value) {
                  console.log('聊天元装');
                  self.initChatData(chatId, false);
                  def.resolve(true);
              });
            } else {
              console.log("无效的聊天标识");
              def.resolve(false);
            }
          });
        // })
        return def.promise;
      },
      changeChatName : function(chatId, chatName) {
        var self = this;
        if(chatId && self.isChatLoaded(chatId)) {
          $rootScope.chats[chatId].meta.name = chatName;
        }
      },
      isChatOwner: function(chatId) {
        var self = this;
        if(self.isNcdataInit() && self.isChatLoaded(chatId) && $rootScope.chats[chatId].meta.owner) {
          return $rootScope.chats[chatId].meta.owner === self.uid;
        } else {
          return false;
        }
      },
      getChat : function(chatId) {
        var self = this;
        if(self.isNcdataInit() && self.isChatLoaded(chatId)) {        
          return $rootScope.chats[chatId];
        }
        else 
          return false;
      },
      getChatData : function(chatId) {
        var self = this;
        if(self.isNcdataInit() && self.isChatLoaded(chatId) ) {        
          return $rootScope.chats[chatId].array;
        }
        else 
          return [];
      },
      appendArray : function(chatId, type, text) {
        var self = this;
        var def = $q.defer();
        if($rootScope.chats[chatId].data.$value === null) {
          self.leaveChat(chatId);
          def.reject();
          return def.promise;
        }
        if(text) {
          var d = new Date();
          //neutriilsed 时区。 
          var timestamp = (0 - (d.getTime() + d.getTimezoneOffset()*60*1000));
          $analytics.eventTrack('message-send', {  category: 'message', label: type });
          return $rootScope.chats[chatId].array.$add({ 
            text: text, 
            timestamp : Firebase.ServerValue.TIMESTAMP,
            author : self.uid,
            type : type,
            invertedTimestamp : timestamp
          });
        }
      },
      /** 社会登录 */
      getUserSettings : function(settingKey) {
        var self = this;
        if(self.isNcdataInit() && $rootScope.user.settings) {
          return $rootScope.user.settings[settingKey];
        } else {
          return false;
        }
      }, 
      setUserSettings : function(settingKey, settingValue) {
        var self = this;
        if(self.isNcdataInit()) {
          if($rootScope.user.settings === undefined) {
            $rootScope.user.settings = {};
          }
          $rootScope.user.settings[settingKey] = settingValue;
        }
      },
      getAuthState : function(loginProvider) {
        var self = this;
        var authData = self.authObj.$getAuth();
        if(authData) {
          return authData.provider == loginProvider;
        } else {
          return false;
        }
      },  
      logoutUser : function() {
        var self = this;
        var def = $q.defer();
        self.authObj.$unauth();
        self.authAnonymous(function() {
          def.resolve();
        });
        return def.promise;
      },
      authUser : function(loginProvider) {
        console.log('login');
        var self = this;
        var def = $q.defer();
        self.fbRef.authWithOAuthPopup("google", function(error, authData) {
          if (error) {
            console.log("登录失败!", error);
            def.reject();
          } else {
            console.log("有效载荷成功验证:", authData);
            def.resolve();
          }
        });
        return def.promise;
      },
      uploadFile : function(file) {
        console.log(file);
        // angular.forEach(files, function(file) {
        return Upload.http({
            url : 'https://api.imgur.com/3/image',
            headers : {
              'Content-Type': file.type ? file.type : 'application/octet-stream',
           Authorization : 'Client-ID ebd061b0a74c9e5',
		 //  Authorization : 'Client-ID 738ec210e1fa4b8',
              // Accept: 'application/json'
            },
            data : file
          });
        // });
      }
    };
  }
  NCService.$inject = ['$q', '$analytics', '$firebaseArray', '$firebaseObject', '$firebaseAuth', '$rootScope', '$stateParams', '$state', '$mdToast', 'Upload'];
})();
(function(){
  angular
	.module('nullchat')
	.filter('showFirstChar', function () {
	    return function (ownerName) {
	    	if(ownerName && ownerName.length > 1)
	        	return ownerName[0];
	       	else 
	       		return ownerName;
	    }
	})
	.filter('fromNow', function() {
	  return function(date) {
	    return moment(date).fromNow();
	  }
	})
	.filter('nl2br', function() {
	  return function(text) {
	  	// console.log(text);
	    return text.replace(/&#10;/g, '<br/>');
	  };
	})
	// .filter('showTotalUnreadCount', function($rootScope) {
	// 	return function(date) {
	// 		var total = 0;
	// 	      $rootScope.chats
	// 	      angular.forEach($rootScope.chats, function(value, chatId){
	// 	        total += $rootScope.chats[chatId].unreadCount;
	// 	      });
	// 	      var title = 'InstantChat.io';
	// 	      if(total>0){
	// 	        title = '('+total+') ' + title; 
	// 	      }
	// 	      return title;
	// 	}
	// })
})();
