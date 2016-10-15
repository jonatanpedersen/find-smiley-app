import {get} from '../client/api';
import {createSearch,createSearchIndex} from '../client/search';

export async function main () {
  try {
    let documents = [];
    let position = null;
    let search = createSearch2(documents, position);

    let handlers = {
      position: async (newPosition) => {
        position = newPosition;
        search = createSearch2(documents, position);
      },
      search: async (searchQuery) => {
        let searchResult = search(searchQuery, null, 0, 20);

        postMessage({topic: 'searchResult', data: searchResult});
      }
    };

    let dispatch = createDispatch(handlers)

    onmessage = (event) => dispatch(event.data.topic, event.data.data);

    documents = await getDocuments();
    search = createSearch2(documents, position);
    postMessage({topic: 'searchReady'});
  } catch (err) {
    postMessage({topic: 'error', data: err});
  }
}

async function getDocuments () {
  return get('/api/documents');
}

function createDispatch (handlers) {
  return async function dispatch(topic, data) {
    let handler = handlers[topic];

    if (handler) {
      return handler(data);
    }
  }
}

function createSearch2 (documents, position) {
  if (position) {
    documents.forEach(document => {
      document.distance = getDistanceFromLatLonInKm(position.latitude, position.longitude, document.latitude, document.longitude);
    });

    documents.sort((a,b) => a.distance - b.distance);
  }

  let searchIndex = createSearchIndex(documents);

  return createSearch(searchIndex, documents);
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
