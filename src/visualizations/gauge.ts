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

function updateOptions(config: any, queryResponse: any, data: any) {
  const { measure_like: measureLike } = queryResponse.fields;
  const measures1: Measure[] = measureLike.map((measure: any) => ({
    label: measure.label_short ?? measure.label,
    name: measure.name,
  }));

  const updatedOptions = { ...vis.options };
  updatedOptions["currentValue"] = {
    section: "Metrics",
    type: "string",
    label: "Current Value",
    display: "select",
    order: 1,
    values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
    default: measures1[0].name,
  };
  // updated
  updatedOptions["minValuePct"] = {
    section: "Metrics",
    type: "number",
    label: "Minimum Value %",
    display: "number",
    order: 2,
    default: 0,
  };
  updatedOptions["endRedBeginYellowPct"] = {
    section: "Metrics",
    type: "number",
    label: "End Red Begin Yellow %",
    display: "number",
    order: 3,
    default: 80,
  };
  updatedOptions["endYellowBeginGreenPct"] = {
    section: "Metrics",
    type: "number",
    label: "End Yellow Begin Green %",
    display: "number",
    order: 4,
    default: 90,
  };
  updatedOptions["targetValue"] = {
    section: "Metrics",
    type: "string",
    label: "Target Value",
    display: "select",
    order: 5,
    values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
    default: measures1[0].name,
  };
  updatedOptions["endGreenBeginYellowPct"] = {
    section: "Metrics",
    type: "number",
    label: "End Green Begin Yellow %",
    display: "number",
    order: 6,
    default: 110,
  };
  updatedOptions["endYellowBeginRedPct"] = {
    section: "Metrics",
    type: "number",
    label: "End Yellow Begin Red %",
    display: "number",
    order: 7,
    default: 120,
  };
  updatedOptions["maxValuePct"] = {
    section: "Metrics",
    type: "number",
    label: "Maximum Value %",
    display: "number",
    order: 8,
    default: 140,
  };

  return updatedOptions;
}

const vis: GaugeViz = {
  id: "gauge-chart", // id/label not required, but nice for testing and keeping manifests in sync
  label: "gauge-chart",
  //  These are the Looker Viz Config menu options.
  options: {
    metricColor: {
      type: "array",
      label: "Metric Color",
      display: "color",
      section: "Style",
    },
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
  update(data, element, config, queryResponse) {
    if (!queryResponse || !queryResponse.fields) {
      console.error("Invalid query response:", queryResponse);
      return;
    }
    const hasAppliedFilters = !!queryResponse && !!queryResponse.applied_filters
    let dashboardLowerFilter = hasAppliedFilters && queryResponse.applied_filters["analytics_func_simple.gauge_lower_threshold"]?.value
    let dashboardUpperFilter = hasAppliedFilters && queryResponse.applied_filters["analytics_func_simple.gauge_upper_threshold"]?.value

    const filterMin = dashboardLowerFilter ? dashboardLowerFilter : config.lowerThreshold
    const filterMax = dashboardUpperFilter ? dashboardUpperFilter : config.upperThreshold

    const errors = handleErrors(this, queryResponse, {
      min_pivots: 0,
      max_pivots: 0,
      min_dimensions: 0,
      max_dimensions: 0,
      min_measures: 3,
      max_measures: 10,
    });

    if (!this.options.minValuePct) {
      const updatedOptions = updateOptions(config, queryResponse, data);
      this.trigger("registerOptions", updatedOptions);
    }

    let [pivots, dimensions, measures] = processQueryResponse(queryResponse);
    let fields = dimensions.concat(measures);
    let timeSeries = fields.filter((field) => field.type?.includes("date"));

    if (timeSeries.length > 1) {
      console.log(
        "More than one date dimension or measure was found. Only one date dimension or measure is supported for time series data."
      );
    }

    const cellValue = (configName: string) => Number(data[0][config[configName]]?.value);
    const cellPct = (configName: string) => Number(data[0][config['targetValue']]?.value) * config[configName] / 100;
    const cellHTML = (configName: string) => data[0][config[configName]] && (data[0][config[configName]].rendered || data[0][config[configName]].value);
    const innerRadius = (minField: string, maxField: string): string => {
      if (cellValue('currentValue') >= cellPct(minField) && cellValue('currentValue') <= cellPct(maxField)) {
        return '40%';
      } else {
        return '90%';
      }
    };
    const goalValue = Number(data[0][config['targetValue']]?.value);
    let currentValue = cellValue('currentValue');

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
        from: cellPct('minValuePct'),
        to: cellPct('endRedBeginYellowPct'),
        color: '#CD3632', 
        innerRadius: innerRadius('minValuePct', 'endRedBeginYellowPct'), 
        outerRadius: '100%'
      }, {
        from: cellPct('endYellowBeginGreenPct'),
        to: cellPct('endGreenBeginYellowPct'),
        color: currentValue >= goalValue ? 'green' : '#686868', 
        innerRadius: currentValue >= maxValue ? '40%' : innerRadius('endYellowBeginGreenPct', 'maxValuePct'), 
        outerRadius: '100%'
      },
    ];

    // Add gray color band if currentValue is less than goal
    if (currentValue < goalValue) {
      options.yAxis.plotBands.push({
        from: currentValue,
        to: goalValue,
        color: '#686868',
        innerRadius: '40%',
        outerRadius: '100%'
      });
    }

    options.title = {
      text: '',
      style: {
        display: 'none' // Remove space reserved for the title
      }
    };

    options.subtitle.style.fontFamily = config.fontFamily;
    options.credits = { enabled: false };
    Highcharts.chart(element, options);

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
      customLabel.textContent = currentValue < goalValue ? cellHTML('targetValue') : '';
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
        currentValueLabel.setAttribute('fill', currentValue >= goalValue ? 'green' : '#e00e45');
        currentValueLabel.setAttribute('font-size', '16px');
        currentValueLabel.setAttribute('font-weight', 'bold');
        currentValueLabel.textContent = cellHTML('currentValue');
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
          goalLabel.textContent = cellHTML('targetValue');
          svg.appendChild(goalLabel);
        }
      }
    }
  }
};

// Move plugin registration to the end
looker.plugins.visualizations.add(vis);
