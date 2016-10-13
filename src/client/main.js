import React from 'react';
import { render } from 'react-dom';
import { Router, Route, IndexRoute, IndexRedirect, Link, browserHistory } from 'react-router';
import * as api from './api';

export function main () {
	let mainElement = document.getElementById('main');

	render((
		<Main>
			<Router history={browserHistory}>
				<Route path="/">
					<IndexRoute component={Index}/>
				</Route>
			</Router>
		</Main>
	), mainElement);
}

class Main extends React.Component {
	render () {
		return (<main>
			{this.props.children}
		</main>);
	}
}

class Index extends React.Component {
	render () {
		return (<div>
			{this.props.children}
		</div>);
	}
}
