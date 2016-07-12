"use strict";
var assert = require('assert');
var request = require("request");
var soajs = require('soajs');

var helper = require("../helper.js");
var config = require("../../config.js");

// Authorization: an encrypted- base 64- value, generated from (tenantId:secret_phrase)
var Authorization = 'Basic MTBkMmNiNWZjMDRjZTUxZTA2MDAwMDAxOnNoaGggdGhpcyBpcyBhIHNlY3JldA==';

var oAuthParams = {
	url: 'http://127.0.0.1:4000/oauth/token',
	method: "POST",
	body: 'username=oauthTestUser&password=oauthpassword&grant_type=password',
	json: true,
	headers: {
		'accept': '*/*',
		'content-type': 'application/x-www-form-urlencoded',
		"Authorization": Authorization
	}
};
var token = null;
var refreshToken = null;
var clientId = null;
var clientTokenCount = null;
var tokenCollectionName = "oauth_token";

var Mongo = soajs.mongo;
var dbConfig = require("./db.config.test.js");

var oauthConfig = dbConfig();
oauthConfig.name = "core_provision";
var mongo = new Mongo(oauthConfig);

function executeMyRequest(params, apiPath, method, cb) {
	requester(apiPath, method, params, function (error, body) {
		assert.ifError(error);
		assert.ok(body);
		return cb(body);
	});

	function requester(apiName, method, params, cb) {
		var options = {
			uri: 'http://127.0.0.1:4000/oauth/' + apiName,
			headers: {
				'Content-Type': 'application/json'
			},
			json: true
		};

		if (params.headers) {
			for (var h in params.headers) {
				if (Object.hasOwnProperty.call(params.headers, h)) {
					options.headers[h] = params.headers.h;
				}
			}
		}

		if (params.form) {
			options.body = params.form;
		}

		if (params.qs) {
			options.qs = params.qs;
		}
		request[method](options, function (error, response, body) {
			assert.ifError(error);
			assert.ok(body);
			return cb(null, body);
		});
	}
}

describe("OAUTH TESTS", function () {

	before(function (done) {
		console.log('Starting tests ...');
		done();
	});

	describe("get Token tests", function () {
		it('success - login', function (done) {
			function callback(error, response, body) {
				assert.ifError(error);
				assert.ok(body);
				assert.ok(body.access_token);
				token = body.access_token;
				done();
			}

			request(oAuthParams, callback);
		});

		it('fail - invalid user', function (done) {
			var params = oAuthParams;
			params.body = 'username=test&password=oauthpass&grant_type=password';
			function callback(error, response, body) {
				assert.ifError(error);
				assert.ok(body);
				assert.ok(body.errors);
				console.log(body);
				assert.deepEqual(body.errors.details[0], {
					"code": 503,
					"message": "Unable to log in the user. User not found."
				});
				done();
			}

			request(oAuthParams, callback);
		});

		it('Fail - wrong username', function (done) {
			var params = oAuthParams;
			params.body = 'username=oauthus&password=oauthpassword&grant_type=password';

			function callback(error, response, body) {
				assert.ifError(error);
				assert.ok(body);
				console.log(body);
				assert.equal(body.errors.details[0].code, 503);
				done();
			}

			request(oAuthParams, callback);
		});

		it('fail - missing params', function (done) {
			var params = oAuthParams;
			params.body = 'username=oauthTestUser';
			function callback(error, response, body) {
				assert.ok(body);
				assert.ok(body.errors);
				console.log(body);
				assert.equal(body.errors.details[0].code, 172);
				done();
			}

			request(oAuthParams, callback);
		});
		it('fail - wrong password', function (done) {
			var params = oAuthParams;
			params.body = 'username=oauthTestUser&password=oauthpass&grant_type=password';
			function callback(error, response, body) {
				assert.ifError(error);
				assert.ok(body);
				assert.ok(body.errors);
				console.log(body);
				assert.deepEqual(body.errors.details[0], {
					"code": 503,
					"message": "Unable to log in the user. User not found."
				});
				done();
			}

			request(oAuthParams, callback);
		});

	});

	describe("kill token tests", function () {

		describe("access token tests", function () {

			it('fail - access token not found', function (done) {
				executeMyRequest({}, 'accessToken/00000', 'del', function (body) {
					assert.deepEqual(body.errors.details[0], {
						"code": 400,
						"message": 'The access token was not found'
					});
					done();
				});
			});

			it ('fail - invalid access token provided', function (done) {
				var params = {
					qs: {
						"access_token": '00000'
					}
				};
				executeMyRequest(params, 'accessToken/' + token, 'del', function (body) {
					assert.deepEqual(body.errors.details[0], {
						"code": 401,
						"message": 'The access token provided is invalid.'
					});
					done();
				});
			});

			it('success - access token found and deleted', function (done) {
				var params = {
					qs: {
						"access_token": token
					}
				};
				executeMyRequest(params, 'accessToken/' + token, 'del', function (body) {
					assert.ok(body);
					assert.deepEqual(body.data, {ok: 1, n: 1});
					done();
				});
			});
		});

		describe("refresh token tests", function () {

			before ('Get a new token and refresh token', function (done) {
				var params = oAuthParams;
				params.body = 'username=oauthTestUser&password=oauthpassword&grant_type=password';
				function callback(error, response, body) {
					assert.ifError(error);
					assert.ok(body);
					assert.ok(body.access_token);
					token = body.access_token;
					refreshToken = body.refresh_token;

					done();
				}

				request(oAuthParams, callback);
			});

			it("fail - access token not found", function (done) {
				executeMyRequest({}, 'refreshToken/' + refreshToken, 'del', function (body) {
					assert.deepEqual(body.errors.details[0], {
						"code": 400,
						"message": 'The access token was not found'
					});
					done();
				});
			});

			it("fail - invalid access token provided", function (done) {
				var params = {
					qs: {
						"access_token": '00000'
					}
				};
				executeMyRequest(params, 'refreshToken/' + refreshToken, 'del', function (body) {
					assert.deepEqual(body.errors.details[0], {
						"code": 401,
						"message": 'The access token provided is invalid.'
					});
					done();
				});
			});

			it("fail - invalid refresh token provided, no records removed from mongo", function (done) {
				var params = {
					qs: {
						"access_token": token
					}
				};
				executeMyRequest(params, 'refreshToken/0000000', 'del', function (body) {
					assert.ok(body.result);
					assert.deepEqual(body.data, {ok: 1, n: 0});
					done();
				});
			});

			it("success - refresh token found and deleted", function (done) {
				var params = {
					qs: {
						"access_token": token
					}
				};
				executeMyRequest(params, 'refreshToken/' + refreshToken, 'del', function (body) {
					assert.ok(body);
					assert.deepEqual(body.data, {ok: 1, n: 1});
					done();
				});
			});

		});
	});

	describe("Remove client tokens tests", function () {

		before("Get client id based on token and count total number of this client's tokens", function (done) {
			var criteria = {token: token};
			mongo.findOne(tokenCollectionName, criteria, function (error, record) {
				assert.ifError(error);
				assert.ok(record);
				clientId = record.clientId;

				criteria = {clientId: clientId};
				mongo.count(tokenCollectionName, clientId, function (error, count) {
					assert.ifError(error);
					clientTokenCount = count;
					done();
				});
			});
		});

		it ("fail - wrong access token provided", function (done) {
			var params = {
				qs: {
					"access_token": '1234567890'
				}
			};
			executeMyRequest(params, 'tokens/' + clientId, 'del', function (body) {
				assert.deepEqual(body.errors.details[0], {
					"code": 401,
					"message": 'The access token provided is invalid.'
				});
				done();
			});
		});

		it ("fail - wrong client id provided, no records removed from mongo", function (done) {
			var params = {
				qs: {
					"access_token": token
				}
			};
			executeMyRequest(params, 'tokens/0011234', 'del', function (body) {
				assert.ok (body.result);
				assert.deepEqual(body.data, {ok: 1, n: 0});
				done();
			});
		});

		it ("success - will remove client tokens", function (done) {
			var params = {
				qs: {
					"access_token": token
				}
			};
			executeMyRequest(params, 'tokens/' + clientId, 'del', function (body) {
				assert.ok(body);
				assert.ok(body.result, true);
				assert.equal(body.data.n, clientTokenCount);
				done();
			});
		});
	});
});
