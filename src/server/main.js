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
		let xml = fs.readFileSync('./data/smiley_xml.xml', 'utf8');

		parseString(xml, {explicitArray: false, trim: true}, (err, result)	=> {
			if (err) {
				return callback(err);
			}

			function parseDate (date) {
				return date ? moment(date, 'DD-MM-YYYY').toDate() : undefined;
			}

			function parseNumber (number) {
				return number ? parseInt(number) : undefined;
			}

			let ops = result.document.row
				.map(row => {
					return {
						_id: parseNumber(row.navnelbnr),
						name: row.navn1,
						streetAddress: row.adresse1,
						postalCode: row.postnr,
						city: row.By,
						latitude: row.Geo_Lat,
						longitude: row.Geo_Lng,
						elite: parseNumber(row.Elite_Smiley),
						lastResult: parseNumber(row.seneste_kontrol),
						lastDate: parseDate(row.seneste_kontrol_dato),
						secondLastResult: parseNumber(row.naestseneste_kontrol),
						secondLastDate: parseDate(row.naestseneste_kontrol_dato),
						thirdLastResult: parseNumber(row.tredjeseneste_kontrol),
						thirdLastDate: parseDate(row.tredjeseneste_kontrol_dato),
						forthLastResult: parseNumber(row.fjerdeseneste_kontrol),
						forthLastDate: parseDate(row.fjerdeseneste_kontrol_dato)
					};
				})
				.map(organization => {
					return {
						replaceOne: {
							filter: {_id: organization._id},
							replacement: organization,
							upsert: true
						}
					};
				});

				return db.collection('organizations').bulkWrite(ops)
					.then(() => {
						console.log('done');
						callback(null);
					})
					.catch(err => callback(err));
		});
	}
}

// return nodeFetch(url)
// 	.then(response => response.text())
// 	.then(body => callback(null, body))
// 	.catch(callback);

function getScedulingRule () {
	console.log('getScedulingRule()');
	var rule = new nodeSchedule.RecurrenceRule();
	rule.dayOfWeek = [new nodeSchedule.Range(1, 7)];
	rule.hour = 0;
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

		app.get('/api/organizations', (req, res) => {
			db.collection('organizations').find().toArray().then(organizations => res.json(organizations));
		});

		app.get('/api/organizations/csv', (req, res) => {
			res.setHeader('Content-Type', 'text/html');

			let stream = db.collection('organizations')
				.find()
				.stream()
				.pipe(stringify())
				.pipe(res);
		});

		app.get('/api/organizations/:id', (req, res) => {
			db.collection('organizations').findOne({_id: parseInt(req.params.id)}).then(organization => res.json(organization));
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
		console.error(err);
	}
}
