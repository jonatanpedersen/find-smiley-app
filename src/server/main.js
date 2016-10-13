import { connectToMongoDB } from './mongodb';
import bodyParser from 'body-parser';
import cnf from 'cnf';
import express from 'express';
import http from 'http';
import https from 'https';
import mongodb from 'mongodb';
import path  from 'path';
import url from 'url';
import nodeSchedule from 'node-schedule';
import nodeFetch from 'node-fetch';
import { parseString } from 'xml2js';
import fs from 'fs';

const feedUrl = 'https://www.foedevarestyrelsen.dk/_layouts/15/sdata/smiley_xml.xml';

function noop () {}

function job (callback) {
  callback = callback || noop;
  console.log('job()');

  return downloadFeed(feedUrl, (err, feed) => {
    if (err) {
      return callback(err);
    }

    return parseFeed(feed, (err, parsedFeed) => {
      if (err) {
        return callback(err);
      }

      return processFeed(parsedFeed, (err) => {
        if (err) {
          return callback(err);
        }

        return callback(null);
      });
    });
  });
}

function downloadFeed (url, callback) {
  console.log('downloadFeed()');

	return fs.readFile('./data/smiley_xml.xml', 'utf8', callback);
  // return nodeFetch(url)
	// 	.then(response => response.text())
	// 	.then(body => callback(null, body))
	// 	.catch(callback);
};

function parseFeed (feed, callback) {
  console.log('parseFeed()');

  parseString(feed, {explicitArray: false, trim: true}, (err, result)  => {
    if (err) {
      return callback(err);
    }

    return callback(null, result);
  });
}

function processFeed (parsedFeed, callback) {
  console.log('processFeed()');

	let rows = parsedFeed.document.row;

	let memo = rows.reduce((memo, next) => {
		let id = next.navnelbnr;
		memo[id] = memo[id] || { reports: []};
		let entry = memo[id];
		entry.name = next.navn1;
		entry.streetAddress = next.adresse1;
		entry.postalCode = next.postnr;
		entry.city = next.By;
		entry.latitude = next.Geo_Lat;
		entry.longitude = next.Geo_Lng;
		entry.reports.push({result: next.seneste_kontrol, date: next.seneste_kontrol_dato})

		return memo;
	})

  console.log(JSON.stringify(memo, null, 4));

  return callback(null);
}

function getScedulingRule () {
	console.log('getScedulingRule()');
	var rule = new nodeSchedule.RecurrenceRule();
	rule.dayOfWeek = [new nodeSchedule.Range(1, 7)];
	rule.hour = 0;
	rule.minute = 0;
	return rule;
}

export function main () {
  let scheduledJobs = [];
  let app = express();

  app.use(bodyParser.json());

  app.use('/', express.static('./public'));
  app.use('/*', express.static('./public/index.html'));

  let httpServer = http.createServer(app);
  let port = process.env.PORT || 8080;

  httpServer.listen(port, () => {
    console.log(`listening on ${port}`);

    scheduledJobs.push(nodeSchedule.scheduleJob(getScedulingRule(), job));
    scheduledJobs.push(nodeSchedule.scheduleJob(new Date(), job));
  });
}
