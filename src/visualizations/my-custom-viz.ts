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


// import './my-custom-viz.scss'

declare var LookerCharts: LookerChartUtils;
declare var looker: Looker;


interface BarChartRace extends VisualizationDefinition {
    elementRef?: HTMLDivElement,
}

const vis: BarChartRace = {
    id: 'dev_only_bar_char_racing', 
    label: 'Bar Chart Race',
    options: {
        title: {
            type: 'string',
            label: 'Title',
            display: 'text',
            default: 'Default Text'
        }
    },
    
    create(element, config) {
        this.elementRef = element;

    
    var container = element.appendChild(document.createElement("div"));
    container.className = "hello-world-vis";

    
    this._textElement = container.appendChild(document.createElement("div"));

    this.svg = d3.select(element).append('svg')

    },
    updateAsync(data, element, config, queryResponse,details, doneRendering) {
        console.log( 'data', data );
        console.log( 'element', element );
        console.log( 'config', config );
        console.log( 'queryResponse', queryResponse );
        const errors = handleErrors(this, queryResponse, {
            // min_pivots: 0,
            // max_pivots: 0,
            // min_dimensions: 1,
            // max_dimensions: 1,
            // min_measures: 1,
            // max_measures: 1
        });
        const duration = 250
        const width = element.clientWidth
        const height = element.clientHeight

        var replay;

        replay;

        const svg = d3.create("svg")
             .attr("viewBox", [0, 0, width, height]);

        const updateBars = bars(svg);
        const updateAxis = axis(svg);
        const updateLabels = labels(svg);
        const updateTicker = ticker(svg);

        yield svg.node();

        for (const keyframe of keyframes()) {
            const transition = svg.transition()
                .duration(duration)
                .ease(d3.easeLinear);

        // Extract the top bar’s value.
                svg.x.domain([0, keyframe[1][0].value]);

                updateAxis(keyframe, transition);
                updateBars(keyframe, transition);
                updateLabels(keyframe, transition);
                updateTicker(keyframe, transition);

                invalidation.then(() => svg.interrupt());
                await transition.end();
         }

        d3.group(data, d => d.name)
        var n = 12
        var names = new Set(data.map(d => d.name))

        var datevalues = Array.from(d3.rollup(data, ([d]) => d.value, d => +d.date, d => d.name))
                  .map(([date, data]) => [new Date(date), data])
                  .sort(([a], [b]) => d3.ascending(a, b))

        function rank(value) {
          const data = Array.from(names, name => ({name, value: value(name) || 0}));
          data.sort((a, b) => d3.descending(a.value, b.value));
          for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
          return data;
        }

        var k =10

        var keyframes = function(){
          const keyframes = [];
          let ka, a, kb, b;
          for ([[ka, a], [kb, b]] of d3.pairs(datevalues)) {
            for (let i = 0; i < k; ++i) {
              const t = i / k;
              keyframes.push([
                new Date(ka * (1 - t) + kb * t),
                rank(name => a.get(name) * (1 - t) + b.get(name) * t)
              ]);
            }
          }
          keyframes.push([new Date(kb), rank(name => b.get(name))]);
          return keyframes;
        }                  
        var newFrames = keyframes()
        var nameframes = d3.groups(newFrames.flatMap(([, data]) => data), d => d.name)
        var prev = new Map(nameframes.flatMap(([, data]) => d3.pairs(data, (a, b) => [b, a])))
        var next = new Map(nameframes.flatMap(([, data]) => d3.pairs(data)))

        function bars(svg) {
          let bar = svg.append("g")
              .attr("fill-opacity", 0.6)
            .selectAll("rect");

          return ([date, data], transition) => bar = bar
            .data(data.slice(0, n), d => d.name)
            .join(
              enter => enter.append("rect")
                .attr("fill", color)
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

        function labels(svg) {
          let label = svg.append("g")
              .style("font", "bold 12px var(--sans-serif)")
              .style("font-variant-numeric", "tabular-nums")
              .attr("text-anchor", "end")
            .selectAll("text");

          return ([date, data], transition) => label = label
            .data(data.slice(0, n), d => d.name)
            .join(
              enter => enter.append("text")
                .attr("transform", d => `translate(${x((prev.get(d) || d).value)},${y((prev.get(d) || d).rank)})`)
                .attr("y", y.bandwidth() / 2)
                .attr("x", -6)
                .attr("dy", "-0.25em")
                .text(d => d.name)
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

        function textTween(a, b) {
          const i = d3.interpolateNumber(a, b);
          return function(t) {
            this.textContent = formatNumber(i(t));
          };
        }

        var formatNumber = d3.format(",d")

        function axis(svg) {
          const g = svg.append("g")
              .attr("transform", `translate(0,${margin.top})`);

          const axis = d3.axisTop(x)
              .ticks(width / 160)
              .tickSizeOuter(0)
              .tickSizeInner(-barSize * (n + y.padding()));

          return (_, transition) => {
            g.transition(transition).call(axis);
            g.select(".tick:first-of-type text").remove();
            g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "white");
            g.select(".domain").remove();
          };
        }

        function ticker(svg) {
          const now = svg.append("text")
              .style("font", `bold ${barSize}px var(--sans-serif)`)
              .style("font-variant-numeric", "tabular-nums")
              .attr("text-anchor", "end")
              .attr("x", width - 6)
              .attr("y", margin.top + barSize * (n - 0.45))
              .attr("dy", "0.32em")
              .text(formatDate(keyframes[0][0]));

          return ([date], transition) => {
            transition.end().then(() => now.text(formatDate(date)));
          };
        }

        function color () {
        //color = {
          const scale = d3.scaleOrdinal(d3.schemeTableau10);
          if (data.some(d => d.category !== undefined)) {
            const categoryByName = new Map(data.map(d => [d.name, d.category]))
            scale.domain(Array.from(categoryByName.values()));
            return d => scale(categoryByName.get(d.name));
          }
          return d => scale(d.name);
        }

        var x = d3.scaleLinear([0, 1], [margin.left, width - margin.right]);
        var y = d3.scaleBand()
            .domain(d3.range(n + 1))
            .rangeRound([margin.top, margin.top + barSize * (n + 1 + 0.1)])
            .padding(0.1);


        
        var barSize = 48;
        var margin = ({top: 16, right: 6, bottom: 6, left: 0});    

        var firstRow = data[0];
        var firstCell = firstRow[queryResponse.fields.dimensions[0].name].value;        


        //this._textElement.innerHTML = LookerChart.Utils.htmlForCell(firstCell)
        this._textElement.innerHTML = LookerCharts.Utils.htmlForCell(firstRow[queryResponse.fields.dimensions[0].name].value);



        if (errors) { // errors === true means no errors
            element.innerHTML = 'Hello Looker!';
        }
    }

};

looker.plugins.visualizations.add(vis);
