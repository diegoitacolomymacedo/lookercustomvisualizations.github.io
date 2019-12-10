import { handleErrors } from '../common/utils';
import { 
    Looker, 
    VisualizationDefinition, 
    LookerChartUtils, 
    Cell, 
    PivotCell
} from '../common/types';

import * as d3 from 'd3'
import * as d3array from 'd3-array'

//import './my-custom-viz.scss'

declare var LookerCharts: LookerChartUtils;
declare var looker: Looker;

interface BarChartRace extends VisualizationDefinition {
    elementRef?: HTMLDivElement,
}

let barCount = 12;
const k = 10;
let duration = 250;
let barSize = 48;
let replay = true;
const margin = ({top: 16, right: 6, bottom: 6, left: 0});


const create = (element, config) => {
  this.elementRef = element; 
  var container = element.appendChild(document.createElement("div"));
  container.className = "Bar_chart_race";    
  this._textElement = container.appendChild(document.createElement("div"));
  this.svg = d3.select(element).append('svg');
  this.svg.append("g")
    .attr("class", "g-axis")
    .attr("transform", `translate(0,${margin.top})`);
  this.svg.append("g")
    .attr('class', 'g-bars')
    .attr("fill-opacity", 0.6);
  this.svg.append("g")
    .attr('class', 'g-labels')
    .attr("font-weight","bold")
    .attr("font-size","12px")
    .attr("font-family","sans-serif")
    .style("font-variant-numeric", "tabular-nums")
    .attr("text-anchor", "end")
  this.svg.append("text")
    .attr('class', 'g-ticker')
    .attr("font-weight", "bold")
    .attr("font-family","sans-serif")
    //.attr("font-size","48px")
    .attr("font-size", "${barsize}px")
    .style("font-variant-numeric", "tabular-nums")
    .attr("text-anchor", "end");
}

const updateAsync = (data, element, config, queryResponse,details, doneRendering) => {
  const errors = handleErrors(this, queryResponse, {
    min_pivots: 0,
    max_pivots: 0,
    min_dimensions: 1,
    max_dimensions: 1,
    min_measures: 1,
    max_measures: 1
  });
  
  //load configs
  barCount = config.barCount;
  barSize = config.barsize;
  duration = config.duration;
  replay = config.replay;  


  const width = element.clientWidth
  const height = element.clientHeight
  const x = d3.scaleLinear([0, 1], [margin.left, width - margin.right]);
  const y = d3.scaleBand()
      .domain(d3.range(barCount + 1))
      .rangeRound([margin.top, margin.top + barSize * (barCount + 1 + 0.1)])
      .padding(0.1);

  const formatNumber = d3.format(",d");
  const formatDate = d3.utcFormat("%B, %Y");
  const names = new Set(data.map(d => d['vw_watchtime_bar_racing.nome'].value))
  
  let datevalues = Array.from(d3array.rollup(data, ([d]) => d['vw_watchtime_bar_racing.valor'].value, d => d['vw_watchtime_bar_racing.data'].value, d => d['vw_watchtime_bar_racing.nome'].value))
  datevalues = datevalues.map(([date, data]) => [new Date(date+'T00:00:00'), data]);
  datevalues = datevalues.sort(([a], [b]) => d3.ascending(a, b));

  const genKeyframes = () => {
    const frames = [];
    let ka, a, kb, b;

    for ([[ka, a], [kb, b]] of d3.pairs(datevalues)) {
      for (let i = 0; i < k; ++i) {
        const t = i / k;
        frames.push([
          new Date(ka * (1 - t) + kb * t),
          rank(name => a.get(name) * (1 - t) + b.get(name) * t)
        ]);
      }
    }
    frames.push([new Date(kb), rank(name => b.get(name))]);
    return frames;
  }
  const rank = (value) => {
    const data = Array.from(names, name => ({name, value: value(name) || 0, rank: 0}));
    data.sort((a, b) => d3.descending(a.value, b.value));
    
    for (let i = 0; i < data.length; ++i){
      data[i].rank = Math.min(barCount, i);
    }
    return data;
  }

  let flatMap = genKeyframes().flatMap(([, data]) => data);
  let nameframes = d3array.groups(flatMap, d => d.name);
  var prev = new Map(nameframes.flatMap(([, data]) => d3.pairs(data, (a, b) => [b, a])));
  var next = new Map(nameframes.flatMap(([, data]) => d3.pairs(data)));

  const bars = (svg) => {
    let bar = svg.select('.g-bars').selectAll("rect");

    return ([date, data], transition) => bar = bar
      .data(data.slice(0, barCount), d => d.name)
      .join(
        enter => enter.append("rect")
          .attr("fill", color())
          .attr("titleLabel", titleLabel())
          .attr("height", y.bandwidth())
          .attr("x", x(0))
          .attr("y", d => y((prev.get(d) || d).rank))
          .attr("width", d => x((prev.get(d) || d).value) - x(0)),
        update => update,
        exit => exit.transition(transition).remove()
          .attr("y", d => y((next.get(d) || d).rank))
          .attr("width", d => x((next.get(d) || d).value) - x(0))
      )
      .call(bar => bar.transition(transition)
        .attr("y", d => y(d.rank))
        .attr("width", d => x(d.value) - x(0)));
  }

  const labels = (svg) => {
    let label = svg.select('.g-labels').selectAll("text");

    return ([date, data], transition) => label = label
      .data(data.slice(0, barCount), d => d.name)
      .join(
        enter => enter.append("text")
          .attr("transform", d => `translate(${x((prev.get(d) || d).value)},${y((prev.get(d) || d).rank)})`)
          .attr("y", y.bandwidth() / 2)
          .attr("x", -6)
          .attr("dy", "-0.25em")
          .text(titleLabel())
          .call(text => text.append("tspan")
            .attr("fill-opacity", 0.7)
            .attr("font-weight", "normal")
            .attr("x", -6)
            .attr("dy", "1.15em")),
        update => update,
        exit => exit.transition(transition).remove()
          .attr("transform", d => `translate(${x((next.get(d) || d).value)},${y((next.get(d) || d).rank)})`)
          .call(g => g.select("tspan").tween("text", d => textTween(d.value, (next.get(d) || d).value)))
      )
      .call(bar => bar.transition(transition)
        .attr("transform", d => `translate(${x(d.value)},${y(d.rank)})`)
        .call(g => g.select("tspan").tween("text", d => textTween((prev.get(d) || d).value, d.value))))
  }

  const textTween = (a, b) => {
    const i = d3.interpolateNumber(a, b);
    return function(t) {
      this.textContent = formatNumber(i(t));
    };
  }

  const axis = (svg) => {
    const g = svg.select('.g-axis')
    const axis = d3.axisTop(x)
        .ticks(width / 160)
        .tickSizeOuter(0)
        .tickSizeInner(-barSize * (barCount + y.padding()));

    return (_, transition) => {
      //console.log('updateAxis');
      g.transition(transition).call(axis);
      g.select(".tick:first-of-type text").remove();
      g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "white");
      g.select(".domain").remove();
    };
  }

  const ticker = (svg) => {
    const now = svg.select('.g-ticker')
        .attr("x", width - 6)
        .attr("y", margin.top + barSize * (barCount - 0.45))
        .attr("dy", "0.32em")
        .text(formatDate(genKeyframes()[0][0]));

    return ([date], transition) => {
      transition.end().then(() => now.text(formatDate(date)));
    };
  }

  const color = () => {
      
    const scale = d3.scaleOrdinal(d3.schemeTableau10);
    if (data.some(d => d['vw_watchtime_bar_racing.tele_studio'].value !== undefined)) {
      
      const categoryByName = new Map(data.map(d => [d['vw_watchtime_bar_racing.nome'].value, d['vw_watchtime_bar_racing.tele_studio'].value]))
      
      scale.domain(Array.from(categoryByName.values()));
    
      return d => scale(categoryByName.get(d.name));
    }
    return d => scale(d['vw_watchtime_bar_racing.nome'].value);
  }
  


  const titleLabel = () => {
    
      if (data.some(d => d['vw_watchtime_bar_racing.tele_studio'].value !== undefined)) {
      
      

      const categoryByName = new Map(data.map(d => [d['vw_watchtime_bar_racing.nome'].value, d['vw_watchtime_bar_racing.tele_studio'].value]))
      return d => `${d.name} - ${categoryByName.get(d.name)}`;

    }
    
    return d => d['vw_watchtime_bar_racing.nome'].value;
  }


  const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }

  const chart = async () => {
    
    do {
      const svg = this.svg.attr('width', width).attr('height', height);
      const updateBars = bars(svg);
      const updateAxis = axis(svg);
      const updateLabels = labels(svg);
      const updateTicker = ticker(svg);

      const frames = genKeyframes();
      
      

      for (const keyframe of frames) {
        const transition = svg.transition()
          .duration(duration)
          .ease(d3.easeLinear);
        
        // Extract the top bar’s value.
        x.domain([0, keyframe[1][0].value]);
        updateAxis(keyframe, transition);
        updateBars(keyframe, transition);
        updateLabels(keyframe, transition);
        updateTicker(keyframe, transition);
        await transition.end();
      }

      await sleep(10000)

    } while(replay)
    

  } 

  chart();
  doneRendering();  
}

const vis: BarChartRace = {
    id: 'dev_only_bar_char_racing', 
    label: 'Bar Chart Race',
    options: {
          barCount : {
            type: 'number',
            label: 'Quantidade de barras exibidas',
            display: 'number',
            default: 12
          },
          barsize : {
            type: 'number',
            label: 'Altura das barras',
            display: 'number',           
            default: 48
          },
          duration : {
            type: 'number',
            label: 'Duração da animação',
            display: 'number',
            default: 250
          },
          replay : {
            type: 'boolean',
            label: 'Permitir Replay?',
            display: 'radio',
            default: true
          }
    },
    create,
    updateAsync,
    
};

looker.plugins.visualizations.add(vis);
