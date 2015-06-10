var start = Date.now();
var loadCount = 0;

function getData() {
  // generate some dummy data
  data = {
    start_at: new Date().getTime() / 1000,
    databases: {}
  };

  for (var i = 1; i <= ENV.rows; i++) {
    data.databases["cluster" + i] = {
      queries: []
    };

    data.databases["cluster" + i + "slave"] = {
      queries: []
    };
  }

  Object.keys(data.databases).forEach(function(dbname) {
    var info = data.databases[dbname];

    var r = Math.floor((Math.random() * 10) + 1);
    for (var i = 0; i < r; i++) {
      var q = {
        canvas_action: null,
        canvas_context_id: null,
        canvas_controller: null,
        canvas_hostname: null,
        canvas_job_tag: null,
        canvas_pid: null,
        elapsed: Math.random() * 15,
        query: "SELECT blah FROM something",
        waiting: Math.random() < 0.5
      };

      if (Math.random() < 0.2) {
        q.query = "<IDLE> in transaction";
      }

      if (Math.random() < 0.1) {
        q.query = "vacuum";
      }

      info.queries.push(q);
    }

    info.queries = info.queries.sort(function(a, b) {
      return b.elapsed - a.elapsed;
    });
  });

  return data;
}

var _base;

(_base = String.prototype).lpad || (_base.lpad = function(padding, toLength) {
  return padding.repeat((toLength - this.length) / padding.length).concat(this);
});

function formatElapsed(value) {
  str = parseFloat(value).toFixed(2);
  if (value > 60) {
    minutes = Math.floor(value / 60);
    comps = (value % 60).toFixed(2).split('.');
    seconds = comps[0].lpad('0', 2);
    ms = comps[1];
    str = minutes + ":" + seconds + "." + ms;
  }
  return str;
}

var Query = function(props) {
  var className = "elapsed short";
  if (props.elapsed >= 10.0) {
    className = "elapsed warn_long";
  }
  else if (props.elapsed >= 1.0) {
    className = "elapsed warn";
  }

  return Query.template({
    query: props.query,
    elapsed: props.elapsed ? formatElapsed(props.elapsed) : '',
    className: className
  });
};
Query.template = _.template(document.getElementById('template-Query').innerHTML);

var sample = function (queries, time) {
  var topFiveQueries = queries.slice(0, 5);
  while (topFiveQueries.length < 5) {
    topFiveQueries.push({ query: "" });
  }

  var _queries = [];
  topFiveQueries.forEach(function(query, index) {
    _queries.push(
      Query(query)
    );
  });

  var countClassName = "label";
  if (queries.length >= 20) {
    countClassName += " label-important";
  }
  else if (queries.length >= 10) {
    countClassName += " label-warning";
  }
  else {
    countClassName += " label-success";
  }

  _queries.unshift(
    sample.template({
      countClassName: countClassName,
      queriesLength: queries.length
    })
  );
  return _queries.join('');
};
sample.template = _.template(document.getElementById('template-sample').innerHTML);

var Database = function(props) {
  var lastSample = props.samples[props.samples.length - 1];

  return Database.template({
    sample: sample(lastSample.queries, lastSample.time),
    dbname: props.dbname
  });
};
Database.template = _.template(document.getElementById('template-Database').innerHTML);

var Databases = function (props) {
  var databases = [];

  Object.keys(props.databases).forEach(function(dbname) {
    databases.push(
      Database({
        dbname: dbname,
        samples: props.databases[dbname].samples
      })
    );
  });

  return Databases.template({
    databases: databases.join('')
  });
};
Databases.template = _.template(document.getElementById('template-Databases').innerHTML);

var DBMon = function (render) {
  var state = {
    databases: {}
  };

  var loadSamples = function () {
    loadCount++;
    var newData = getData();

    Object.keys(newData.databases).forEach(function(dbname) {
      var sampleInfo = newData.databases[dbname];

      if (!state.databases[dbname]) {
        state.databases[dbname] = {
          name: dbname,
          samples: []
        }
      }

      var samples = state.databases[dbname].samples;
      samples.push({
        time: newData.start_at,
        queries: sampleInfo.queries
      });
      if (samples.length > 5) {
        samples.splice(0, samples.length - 5);
      }
    });

    render(state);

    setTimeout(loadSamples, ENV.timeout);
  };

  loadSamples();
};

var parser = new DOMParser();
var root = document.getElementById('dbmon');

DBMon(function (state) {
  var html = Databases(state);
  var dom = parser.parseFromString(html, 'text/html');

  dompatch(root, dom.body.firstChild);

  console.log(Date.now() - start);
  start = Date.now();
});
