import React from 'react';
import { render } from 'react-dom';
import { Router, Route, IndexRoute, IndexRedirect, Link, browserHistory } from 'react-router';
import {get} from './api';
import {createSearchIndex, createSearch} from './search';
import mainStyles from './main.scss';
import classnames from 'classnames';
import moment from 'moment';

async function getDocuments () {
	return get('/api/documents');
}

function createDocumentsMap (documents) {
	return documents.reduce((documentsMap, nextDocument) => {
		documentsMap[nextDocument._id] = nextDocument;
		return documentsMap;
	}, {});
}

function createDocumentsArray (documentsMap) {
	return;
}

export async function main () {
	try {

		let topics = {};
		let publish = (topic, data) => {
			let callbacks = topics[topic] && [...topics[topic]];

			if (callbacks) {
				return Promise.all(callbacks.map(callback => callback(data)));
			}
		};

		let subscribe = (topic, callback) => {
			topics[topic] = topics[topic] || new Set();
			topics[topic].add(callback);
		};

		let unsubscribe = (topic, callback) => {
			topics[topic] && topics[topic].delete(callback);
		};

		// Worker Setup
		var worker = new Worker("worker.js");

		subscribe('position', position => {
			worker.postMessage({topic: 'position', data: position});
		});

		subscribe('search', searchQuery => {
			worker.postMessage({topic: 'search', data: searchQuery});
		});

		worker.onmessage = (event) => {
			let message = event.data;
			publish(message.topic, message.data);
		}

		// Position Setup
		let watchId = navigator.geolocation.watchPosition(currentPosition => {
			let {latitude, longitude} = currentPosition.coords;

			publish('position', {latitude, longitude});
		}, err => {
			publish('position', undefined);
		});

		let mainElement = document.getElementById('main');

		render((
			<Router history={browserHistory}>
				<Route path="/" component={withProps(Main, {publish, subscribe, unsubscribe})}>
					<IndexRoute component={withProps(Home, {publish, subscribe, unsubscribe})}/>
				</Route>
			</Router>
		), mainElement);
	} catch (err) {
		console.error(err);
	}
}

class Main extends React.Component {
	constructor (props) {
		super(props);
		this.state = {searchReady: false};
		this.handleSearchReady = this.handleSearchReady.bind(this);
	}

	componentDidMount () {
		this.props.subscribe('searchReady', this.handleSearchReady)
	}

	componentWillUnmount () {
		this.props.unsubscribe('searchReady', this.handleSearchReady);
	}

	handleSearchReady () {
		this.setState({searchReady: true})
	}

	render () {
		let {searchReady} = this.state;

		if (!searchReady) {
			return <Loading />;
		}

		return React.cloneElement(this.props.children);
	}
}

class Home extends React.Component {
	constructor (props) {
		super(props);
		this.handleSearchQueryChange = this.handleSearchQueryChange.bind(this);
		this.handleSearchResult = this.handleSearchResult.bind(this);
		this.state = {};
	}

	componentDidMount () {
		this.props.subscribe('searchResult', this.handleSearchResult);
		this.props.publish('search', this.state.searchQuery);
	}

	componentWillUnmount () {
		this.props.unsubscribe('searchResult', this.handleSearchResult);
	}

	handleSearchResult (searchResult) {
		this.setState({searchResult});
	}

	handleSearchQueryChange (searchQuery) {
		this.setState({searchQuery});

		this.props.publish('search', searchQuery);
	}

	render () {
		let {searchResult} = this.state;

		return (
			<Page>
				<Header />
				<SearchQuery onChange={this.handleSearchQueryChange} />
				<SearchResult searchResult={searchResult} />
			</Page>
		);
	}
}

class Loading extends React.Component {
	render () {
		return (
			<Page>
				<Header />
				<Body>
					<Centered>
						<Smiley type="e" />
						<div className="loading"/>
					</Centered>
				</Body>
				<Footer />
			</Page>
		);
	}
}

class Centered extends React.Component {
	render () {
		return (<div className="centered">
		{this.props.children}
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

class Page extends React.Component {
	render () {
		return (<div className="page">
		{this.props.children}
		</div>);
	}
}

class Body extends React.Component {
	render () {
		return (<div className="body">
		{this.props.children}
		</div>);
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
	componentDidUpdate () {
    var node = this.refs.searchResult;
    node.scrollTop = 0;
  }

	render () {
		if (!this.props.searchResult) {
			return null;
		}

		return (
			<div className="search-result" ref="searchResult">
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
					{document.distance && <p className="distance"><Distance distance={document.distance} /></p>}
					<h4 className="name">{document.name}</h4>
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
