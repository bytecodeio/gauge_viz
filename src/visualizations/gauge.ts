import { Looker, VisualizationDefinition } from "../common/types";
import {
  handleErrors,
  getMinMaxDatetimes,
  processQueryResponse,
  gaugeOptions,
  flexibleGaugeOptions,
} from "../common/utils";
import { fontFamily } from "../common/chart-defaults";
import { Chart, Options } from "highcharts";
import { Highcharts } from "highcharts-more-node";

declare var looker: Looker;

declare var LookerCharts: {
  Utils: {
    htmlForCell: (cell: any) => string;
  };
};

interface GaugeViz extends VisualizationDefinition {
  elementRef?: HTMLDivElement;
}

interface Measure {
  label: string;
  name: string;
}

// Extend HTMLElement to include the chart property
interface ChartHTMLElement extends HTMLElement {
  chart?: Highcharts.Chart;
}

const vis: GaugeViz = {
  id: "gauge-chart", // id/label not required, but nice for testing and keeping manifests in sync
  label: "gauge-chart",
  //  These are the Looker Viz Config menu options.
  options: {
    fontFamily: {
      type: "string",
      label: "Font Family",
      display: "select",
      section: "Style",
      values: [
        { "Arial": "Arial" },
        { "Verdana": "Verdana" },
        { "Helvetica": "Helvetica" },
        { "Times New Roman": "Times New Roman" },
        { "Courier New": "Courier New" },
        { "Georgia": "Georgia" },
        { "Palatino": "Palatino" },
        { "Garamond": "Garamond" },
        { "Comic Sans MS": "Comic Sans MS" },
        { "Trebuchet MS": "Trebuchet MS" },
        { "Arial Black": "Arial Black" },
        { "Impact": "Impact" }
      ],
      default: "Arial",
    },
  },
  // Set up the initial state of the visualization
  create(element, config) {
    element.className = "highcharts-custom-vis";
  },
  // Render in response to the data or settings changing
  updateAsync(data, element: ChartHTMLElement, config, queryResponse, details, doneRendering) {
    if (!queryResponse || !queryResponse.fields) {
      console.error("Invalid query response:", queryResponse);
      return;
    }

    let [pivots, dimensions, measure_like] = processQueryResponse(queryResponse);
    let measures = measure_like
    let fields = dimensions.concat(measures);

    const currentMeasure = measures[0].name;
    const goalMeasure = measures[1].name;

    const cellValue = (measureName: string) => Number(data[0][measureName]?.value);
    const cellHTML = (measureName: string) => data[0][measureName] && (data[0][measureName].rendered || data[0][measureName].value);
    const goalValue = cellValue(goalMeasure);
    let currentValue = cellValue(currentMeasure);

    // Adjust max value based on the current value and the goal
    const maxValue = currentValue > goalValue ? goalValue * 2 : goalValue;
    if (currentValue > maxValue) {
      console.warn('Current value is greater than the max value. Setting current value to twice the goal value.');
      currentValue = maxValue;
    }
    const options: Highcharts.options = flexibleGaugeOptions();

    // Shift the gauge down by adjusting the chart margins
    options.chart.marginTop = 50; // Increase top margin
    options.chart.marginBottom = 0; // Decrease bottom margin

    options.yAxis.min = 0;
    options.yAxis.max = maxValue;
    options.series[0].data = [currentValue];    
    options.series[0].dial.backgroundColor = 'white';
    options.chart.backgroundColor = '#1b1d22';

    const goalSpan = (options.yAxis.max - options.yAxis.min) * 0.02; // 2% of the gauge range
    options.yAxis.plotBands = [
      // Set the colored bands
      {
        from: 0,
        to: maxValue,
        color: '#1b1d22', 
        innerRadius: '40%', // Inner radius for background grey
        outerRadius: '100%'
      },
      {
        from: 0,
        to: 100,
        color: '#CD3632', 
        innerRadius: '80%', 
        outerRadius: '100%'
      }
    ];

    if (currentValue < goalValue) {
      options.yAxis.plotBands.push(
        {
          from: 0,
          to: currentValue,
          color: '#CD3632', // Red
          innerRadius: '40%',
          outerRadius: '100%'
        },
        {
          from: currentValue,
          to: goalValue,
          color: '#686868', // Gray
          innerRadius: '80%',
          outerRadius: '100%'
        }
      );
    } else {
      options.yAxis.plotBands.push(
        {
          from: 0,
          to: goalValue,
          color: '#CD3632', // Red
          innerRadius: '80%',
          outerRadius: '100%'
        },
        {
          from: goalValue,
          to: maxValue,
          color: '#77C043',
          innerRadius: '40%',
          outerRadius: '100%'
        }
      );
    }

    options.title = {
      text: '',
      style: {
        display: 'none' // Remove space reserved for the title
      }
    };

    options.subtitle.style.fontFamily = config.fontFamily;
    options.credits = { enabled: false };

    // Check if chart already exists
    if (element.chart) {
      element.chart.update(options);
    } else {
      element.chart = Highcharts.chart(element, options);
    }

    // Add custom annotations
    const svg = element.querySelector('.highcharts-root');
    const yAxisGroup = element.querySelector('.highcharts-yaxis');
    const trackerGroup = element.querySelector('.highcharts-tracker');

    if (svg && yAxisGroup && trackerGroup) {
      // Add the goal value annotation
      const yAxisBBox = (yAxisGroup as SVGGraphicsElement).getBBox();
      const customLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      customLabel.setAttribute('x', (yAxisBBox.x + yAxisBBox.width + 10).toString());
      customLabel.setAttribute('y', (yAxisBBox.y + yAxisBBox.height ).toString());
      customLabel.setAttribute('text-anchor', 'start');
      customLabel.setAttribute('fill', 'white');
      customLabel.setAttribute('font-size', '16px');
      customLabel.textContent = currentValue < goalValue ? cellHTML(goalMeasure) : '';
      svg.appendChild(customLabel);

      // Add the current value annotation
      const plotArea = element.querySelector('.highcharts-plot-background');
      if (plotArea) {
        const plotBBox = (plotArea as SVGGraphicsElement).getBBox();
        
        // Calculate gauge center and radius
        const centerX = yAxisBBox.x + (yAxisBBox.width / 2);
        const centerY = yAxisBBox.y + (yAxisBBox.height ) -5;
        let radius = Math.min(yAxisBBox.width) / 2;

        if (radius < 0) {
          console.warn('Calculated radius is negative. Setting to 0.');
          radius = 0;
        }
        
        // Calculate angle based on current value
        let angleInDegrees 
        if (currentValue <= goalValue) {
          angleInDegrees= 180 - (180 * (currentValue / goalValue));
        } else {
          angleInDegrees = 180 - (180 * (currentValue / maxValue));
        }
          console.log('angleInDegrees', angleInDegrees);
        const angleInRadians = angleInDegrees * (Math.PI / 180);
        
        // Calculate position based on angle
        const x = centerX + Math.cos(angleInRadians) * radius;
        const y = centerY - Math.sin(angleInRadians) * radius;

        let textAnchorPosition = 'middle'
        if (currentValue < goalValue / 2.2) textAnchorPosition = 'end';
        if (currentValue > goalValue / 1.8) textAnchorPosition = 'start';
        // Create label
        const currentValueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        currentValueLabel.setAttribute('x', x.toString());
        currentValueLabel.setAttribute('y', y.toString());
        currentValueLabel.setAttribute('text-anchor', textAnchorPosition);
        currentValueLabel.setAttribute('fill', currentValue >= goalValue ? '#77C043' : '#e00e45');
        currentValueLabel.setAttribute('font-size', '16px');
        currentValueLabel.setAttribute('font-weight', 'bold');
        currentValueLabel.textContent = cellHTML(currentMeasure);
        svg.appendChild(currentValueLabel);

        // Add goal value annotation at the top if current value is greater than or equal to target value
        if (currentValue >= goalValue) {
          const goalLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          goalLabel.setAttribute('x', centerX.toString());
          goalLabel.setAttribute('y', (centerY - radius - 20).toString()); // Position above the gauge
          goalLabel.setAttribute('text-anchor', 'middle');
          goalLabel.setAttribute('fill', 'white');
          goalLabel.setAttribute('font-size', '16px');
          goalLabel.setAttribute('font-weight', 'bold');
          goalLabel.textContent = cellHTML(goalMeasure);
          svg.appendChild(goalLabel);
        }
      }
    }
    doneRendering();
  }
};

// Move plugin registration to the end
looker.plugins.visualizations.add(vis);
