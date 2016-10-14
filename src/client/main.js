import React from 'react';
import { render } from 'react-dom';
import { Router, Route, IndexRoute, IndexRedirect, Link, browserHistory } from 'react-router';
import {get} from './api';
import {createSearchIndex, createSearch} from './search';
import mainStyles from './main.scss';
import classnames from 'classnames';
import moment from 'moment';
import localforage from 'localforage';

function createDocumentsMap (documents) {
	return documents.reduce((documentsMap, nextDocument) => {
		documentsMap[nextDocument._id] = nextDocument;
		return documentsMap;
	}, {});
}

function createDocumentsArray (documentsMap) {
	return ;
}

export async function main () {
	try {
		localforage.setDriver([localforage.WEBSQL, localforage.INDEXEDDB]);
		let mainElement = document.getElementById('main');

		let documents = await localforage.getItem('documents') || [];

		let after = documents
			.map(document => moment(document.date))
			.reduce((after, date) => {
				return date.isAfter(after) ? date : after;
			}, moment('1970-01-01'))
			.toDate()
			.toISOString();

		console.log(after);

		console.log('fetching documents');
		let newDocuments = await get(`/api/documents?after=${after}`);

		documents = Object.values({...createDocumentsMap(documents),...createDocumentsMap(newDocuments)});

		localforage.setItem('documents', documents);

		console.log('getting position');
		let position = await getCurrentPosition();

		console.log('calculating distances');
		documents.forEach(document => {
			document.distance = getDistanceFromLatLonInKm(position.coords.latitude, position.coords.longitude, document.latitude, document.longitude);
		});

		console.log('sorting documents');
		documents.sort((a,b) => a.distance - b.distance);

		console.log('creating search index');
		let searchIndex = createSearchIndex(documents);
		let search = createSearch(searchIndex, documents);

		render((
			<Router history={browserHistory}>
				<Route path="/">
					<IndexRoute component={withProps(Index, {search})}/>
				</Route>
			</Router>
		), mainElement);
	} catch (err) {
		console.error(err);
	}
}

class Index extends React.Component {
	constructor (props) {
		super(props);
		this.handleSearchQueryChange = this.handleSearchQueryChange.bind(this);
		this.state = {};
	}

	handleSearchQueryChange (newSearchQuery) {
		this.setState({searchQuery: newSearchQuery});
	}

	render () {
		let searchResult = this.props.search(this.state.searchQuery, null, 0, 40);

		return (<div className="index">
			<Header />
			<SearchQuery onChange={this.handleSearchQueryChange} />
			<SearchResult searchResult={searchResult} />
			<Footer />
		</div>);
	}
}

class Header extends React.Component {
	render () {
		return (<header className="header">
		Find Smiley
		</header>);
	}
}

class Footer extends React.Component {
	render () {
		return (<footer className="footer">
			<dl>
				<dt>&copy; 2016</dt>
				<dd><a href="https://www.jonatanpedersen.com/">Jonatan Pedersen</a></dd>
				<dt>Datakilde:</dt>
				<dd><a href="https://www.foedevarestyrelsen.dk/">Fødevarestyrelsen</a></dd>
				<dt>Sidst opdateret:</dt>
				<dd>I dag</dd>
			</dl>
		</footer>);
	}
}

class Smiley extends React.Component {
	render () {
		const className = classnames('sm', 'sm' + this.props.type);

		return (<span className={className}></span>);
	}
}

class SearchQuery extends React.Component {
	render () {
		return (<div className="search-query">
			<input type="search" id="searchQuery" placeholder="Søg på adresse, postnummer, by, firmanavn" name="searchQuery" onChange={event => this.props.onChange && this.props.onChange(event.target.value)} />
		</div>);
	}
}

class SearchResult extends React.Component {
	render () {
		if (!this.props.searchResult) {
			return null;
		}

		return (
			<div className="search-result">
				<SearchResultList documents={this.props.searchResult} />
			</div>
		);
	}
}

class SearchResultList extends React.Component {
	render () {
		let {documents} = this.props;

		let searchResultListItems = Object.keys(documents)
			.map(documentId => documents[documentId])
			.map(document => (
				<SearchResultListItem key={document._id} document={document} />
			));

		return (
			<div className="search-result-list">
				{searchResultListItems}
			</div>
		);
	}
}

class SearchResultListItem extends React.Component {
	render () {
		let {document} = this.props;
		let hasAnyResults = document.lastResult || document.secondLastResult || document.thirdLastResult || document.fourthLastResult;
		return (
			<div className="search-result-list__item">
				<div className="col1">
					<h4 className="name">{document.name}</h4>
					<p className="distance"><Distance distance={document.distance} /></p>
					<p className="address">{document.streetAddress}, {document.postalCode}, {document.city}</p>
				</div>
				<div className="col2">
					{document.elite && <Smiley type="e" />}
				</div>
				{ hasAnyResults && (
					<div className="col3">
						<div><Report result={document.lastResult} date={document.lastDate} /></div>
						<div><Report result={document.secondLastResult} date={document.secondLastDate} /></div>
						<div><Report result={document.thirdLastResult} date={document.thirdLastDate} /></div>
						<div><Report result={document.fourthLastResult} date={document.fourthLastDate} /></div>
					</div>
				)}
			</div>
		);
	}
}

class Report extends React.Component {
	render () {
		let {result, date} = this.props;

		if (!result || !date) {
			return null;
		}

		return (
			<span className="report">
				<Smiley type={result} /><br/><Date date={date} format="MMM-YYYY" />
			</span>
		);
	}
}

class Distance extends React.Component {
	render () {
		let distance = this.props.distance;
		let text;

		if (distance >= 1) {
			text = `${Math.round(distance * 100) / 100}km væk`;
		} else {
			text = `${Math.round(distance * 1000)}m væk`;
		}

		return (
			<span className="distance">
				{text}
			</span>
		);
	}
}

class Date extends React.Component {
	render () {
		let {date,format} = this.props;
		let text = moment(date).format(format);
		return (
			<time className="date">{text}</time>
		);
	}
}

function withProps(Component, props) {
  return React.createClass({
    render() {
      return <Component {...props} {...this.props } {...this.state} />;
    }
  });
};

async function getCurrentPosition () {
	return new Promise ((resolve, reject) => {
		navigator.geolocation.getCurrentPosition(resolve, reject);
	});
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}
