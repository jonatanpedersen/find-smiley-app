import { connectToMongoDB } from './mongodb';
import bodyParser from 'body-parser';
import cnf from 'cnf';
import express from 'express';
import http from 'http';
import https from 'https';
import {MongoClient} from 'mongodb';
import path	from 'path';
import url from 'url';
import nodeSchedule from 'node-schedule';
import nodeFetch from 'node-fetch';
import { parseString } from 'xml2js';
import fs from 'fs';
import moment from 'moment';
import compression from 'compression';
import { stringify } from 'csv';

const feedUrl = 'https://www.foedevarestyrelsen.dk/_layouts/15/sdata/smiley_xml.xml';

function noop () {}

function createJob (db) {
	return function job (callback) {
		console.log('job');

		let propertyNames = ['_id','name','streetAddress','postalCode','city','latitude','longitude','elite','lastResult','lastDate','secondLastResult','secondLastDate','thirdLastResult','thirdLastDate','fourthLastResult','fourthLastDate'];

		let getOldDocumentsTask = db.collection('documents')
			.find()
			.toArray()
			.then(createDocumentsMap);

		let getNewDocumentsTask = nodeFetch(feedUrl)
			.then(getResponseText)
			.then(parseXml)
			.then(mapXmlDataToDocuments)
			.then(createDocumentsMap);

		Promise.all([getOldDocumentsTask, getNewDocumentsTask])
			.then(result => ({oldDocuments: result[0], newDocuments: result[1]}))
			.then(processDocuments)
			.then(callback)
			.catch(err => console.error(err, err.stack));

		function processDocuments ({oldDocuments, newDocuments}) {
			console.log('processDocuments');

			let oldDocumentsIds = new Set(Object.keys(oldDocuments));
			let newDocumentsIds = new Set(Object.keys(newDocuments));

			let documentsToDelete = [...oldDocumentsIds]
				.filter(documentId => !newDocumentsIds.has(documentId));

			let documentsToInsert = [...newDocumentsIds]
				.filter(documentId => !oldDocumentsIds.has(documentId));

			let documentsToReplace = [...oldDocumentsIds]
				.filter(documentId => newDocumentsIds.has(documentId))
				.filter(documentId => {
					let a = JSON.stringify(newDocuments[documentId], propertyNames);
					let b = JSON.stringify(oldDocuments[documentId], propertyNames);

					return a !== b;
				});

			let deleteOperations = documentsToDelete
				.map(documentId => {
					return {
						deleteOne: {
							filter: {_id: documentId}
						}
					};
				});

			let insertOperations = documentsToInsert
				.map(documentId => newDocuments[documentId])
				.map(document => {
					return {
						insertOne: {
							document: document
						}
					};
				});

			let replaceOperations = documentsToReplace
				.map(documentId => newDocuments[documentId])
				.map(document => {
					return {
						replaceOne: {
							filter: {_id: document._id},
							replacement: document
						}
					};
				});

			let operations = [...deleteOperations, ...insertOperations, ...replaceOperations];

			if (operations.length === 0) {
				return;
			}

			return db.collection('documents').bulkWrite(operations).then(() => {
				console.log(`Deleted ${deleteOperations.length} document(s)`);
				console.log(`Inserted ${insertOperations.length} document(s)`);
				console.log(`Replaced ${replaceOperations.length} document(s)`);
			});
		}

		function getResponseText (response) {
			console.log('getResponseText');

			return response.text();
		}

		function parseXml (text) {
			console.log('parseXml');

			return new Promise(resolve => {
				parseString(text, {explicitArray: false, trim: true}, (err, data)	=> {
					if (err) {
						throw err;
					}

					resolve(data);
				});
			});
		}

		function mapXmlDataToDocuments (data) {
			console.log('mapXmlDataToDocuments');

			return data.document.row
				.map(row => {
					return {
						_id: parseNumber(row.navnelbnr),
						name: row.navn1,
						streetAddress: row.adresse1,
						postalCode: row.postnr,
						city: row.By,
						latitude: row.Geo_Lat,
						longitude: row.Geo_Lng,
						elite: parseNumber(row.Elite_Smiley) === 1,
						lastResult: parseNumber(row.seneste_kontrol),
						lastDate: parseDate(row.seneste_kontrol_dato),
						secondLastResult: parseNumber(row.naestseneste_kontrol),
						secondLastDate: parseDate(row.naestseneste_kontrol_dato),
						thirdLastResult: parseNumber(row.tredjeseneste_kontrol),
						thirdLastDate: parseDate(row.tredjeseneste_kontrol_dato),
						fourthLastResult: parseNumber(row.fjerdeseneste_kontrol),
						fourthLastDate: parseDate(row.fjerdeseneste_kontrol_dato),
						date: new Date()
					};
				});
		}

		function createDocumentsMap (documents) {
			console.log('createDocumentsMap');

			return documents.reduce((documentsMap, nextDocument) => {
				documentsMap[nextDocument._id] = nextDocument;
				return documentsMap;
			}, {});
		}

		function parseDate (date) {
			return date ? moment(date, 'DD-MM-YYYY').toDate() : null;
		}

		function parseNumber (number) {
			return number ? parseInt(number) : null;
		}
	}
}

function getScedulingRule () {
	console.log('getScedulingRule()');
	var rule = new nodeSchedule.RecurrenceRule();
	rule.dayOfWeek = [new nodeSchedule.Range(1, 7)];
	rule.hour = 9;
	rule.minute = 0;
	return rule;
}

export async function main () {
	try {
		let connectionString = cnf.mongodb.connectionString;
		let db = await MongoClient.connect(connectionString);

		let scheduledJobs = [];
		let app = express();

		app.use(bodyParser.json());
		app.use(compression());

		app.get('/api/documents', (req, res) => {
			let query = {};

			if (req.query.after) {
				query.date = { $gte: moment(req.query.after).toDate() };
			}

			db.collection('documents')
				.find(query)
				.toArray()
				.then(documents => res.json(documents));
		});

		app.get('/api/documents/csv', (req, res) => {
			res.setHeader('Content-Type', 'text/html');

			let stream = db.collection('documents')
				.find()
				.stream()
				.pipe(stringify())
				.pipe(res);
		});

		app.get('/api/documents/:id', (req, res) => {
			db.collection('documents')
				.findOne({_id: parseInt(req.params.id)})
				.then(document => res.json(document));
		});

		app.use('/', express.static('./public'));
		app.use('/*', express.static('./public/index.html'));

		let httpServer = http.createServer(app);
		let port = cnf.port;

		httpServer.listen(port, () => {
			console.log(`listening on ${port}`);
			let job = createJob(db);

			scheduledJobs.push(nodeSchedule.scheduleJob(getScedulingRule(), job));
			//scheduledJobs.push(nodeSchedule.scheduleJob(new Date(), job));
		});
	} catch (err) {
		console.error(err, err.stack);
	}
}
