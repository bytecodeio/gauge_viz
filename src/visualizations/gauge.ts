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
    redColor: {
      type: "array",
      label: "Red Color",
      display: "color",
      section: "Style",
    },
    greenColor: {
      type: "array",
      label: "Green Color",
      display: "color",
      section: "Style",
    },
    yellowColor: {
      type: "array",
      label: "Yellow Color",
      display: "color",
      section: "Style",
    },
    backgroundColor: {
      type: "array",
      label: "Background Color",
      display: "color",
      section: "Style",
    },
    backgroundDialColor: {
      type: "array",
      label: "Background Dial Color",
      display: "color",
      section: "Style",
    },
    markerColor: {
      type: "array",
      label: "Marker Color",
      display: "color",
      section: "Style",
    },

  },
  // Set up the initial state of the visualization
  create(element, config) {
    element.className = "highcharts-custom-vis";

  },
  // Render in response to the data or settings changing
  update(data, element, config, queryResponse) {
    // console.log("data", data);
    // console.log("element", element);
    // console.log("config", config);
    console.log("queryResponse", queryResponse);
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

    const { measure_like: measureLike } = queryResponse.fields;
    const measures1: Measure[] = measureLike.map((measure) => ({
      label: measure.label_short ?? measure.label,
      name: measure.name,
    }));

    const updatedOptions = { ...this.options };
    updatedOptions["currentValue"] = {
      section: "Metrics",
      type: "string",
      label: "Current Value",
      display: "select",
      order: 1,
      values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
      default: measures1[0].name,
    };
    // updatedOptions["minValue"] = {
    //   section: "Metrics",
    //   type: "string",
    //   label: "Minimum Value",
    //   display: "select",
    //   order: 2,
    //   values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
    //   default: measures1[0].name,
    // };
    updatedOptions["minValuePct"] = {
      section: "Metrics",
      type: "number",
      label: "Minimum Value %",
      display: "number",
      order: 2,
      default: 0,
    };
    // updatedOptions["endRedBeginYellow"] = {
    //   section: "Metrics",
    //   type: "string",
    //   label: "End Red Begin Yellow",
    //   display: "select",
    //   order: 3,
    //   values: measures1.map((measure) => { return { [measure.label]: measure.name } }),
    //   default: measures1[0].name,
    // };
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

    this.trigger("registerOptions", updatedOptions);

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
    const cellHTML = (configName: string) => LookerCharts.Utils.htmlForCell(data[0][config[configName]]);
    const innerRadius = (minField: string, maxField: string): string => {
      if (cellValue('currentValue') >= cellPct(minField) && cellValue('currentValue') <= cellPct(maxField)) {
        return '40%';
      } else {
        return '90%';
      }
    };

    // Display the greatest range possible, so whichever is lower, use it.
    const minValue = cellPct('minValuePct') || 0;

    const maxValue = cellPct('maxValuePct') || 100;

    console.log("minValue", minValue);
    const options: Highcharts.options = flexibleGaugeOptions()

    options.yAxis.min = Number(minValue);
    options.yAxis.max = Number(maxValue);
    options.series[0].data = [cellValue('currentValue')];
    options.subtitle.text = `${cellHTML('currentValue')} of ${cellHTML('targetValue')}`;
    options.title.text = Math.round(cellValue('currentValue') / cellValue('targetValue') * 100) + "%";
    options.series[0].dial.backgroundColor = config.markerColor[0];
    options.chart.backgroundColor = config.backgroundColor[0];

    options.yAxis.plotBands = [
      // Set the colored bands
      {
        from: cellValue('minValue'),
        to: cellValue('maxValue'),
        color: config.backgroundDialColor[0], 
        innerRadius: '40%', // Inner radius for background grey
        outerRadius: '100%'
      },
      {
        from: cellPct('minValuePct'),
        to: cellPct('endRedBeginYellowPct'),
        color: config.redColor[0], 
        innerRadius: innerRadius('minValuePct', 'endRedBeginYellowPct'), 
        outerRadius: '100%'
      }, {
        from: cellPct('endRedBeginYellowPct'),
        to: cellPct('endYellowBeginGreenPct'),
        color: config.yellowColor[0], 
        innerRadius: innerRadius('endRedBeginYellowPct', 'endYellowBeginGreenPct'), 
        outerRadius: '100%'
      }, {
        from: cellPct('endYellowBeginGreenPct'),
        to: cellPct('endGreenBeginYellowPct'),
        color: config.greenColor[0], 
        innerRadius: innerRadius('endYellowBeginGreenPct', 'endGreenBeginYellowPct'), 
        outerRadius: '100%'
      }, {
        from: cellPct('endGreenBeginYellowPct'),
        to: cellPct('endYellowBeginRedPct'),
        color: config.yellowColor[0], 
        innerRadius: innerRadius('endGreenBeginYellowPct', 'endYellowBeginRedPct'), 
        outerRadius: '100%'
      }, {
        from: cellPct('endYellowBeginRedPct'),
        to: cellPct('maxValuePct'),
        color: config.redColor[0], 
        innerRadius: innerRadius('endYellowBeginRedPct', 'maxValuePct'), 
        outerRadius: '100%'
      },
      {
        from: cellPct('minValuePct'),
        to: cellPct('maxValuePct'),
        color: config.metricColor[0], // static style
        innerRadius: '30%', // Inner radius for metric
        outerRadius: '35%'
      }
    ]

    let titleColor = '#000000';
    const plotBands = options.yAxis.plotBands;
    for (let i = 1; i < plotBands.length -1; i++) {
      const band = plotBands[i];
      if (cellValue('currentValue') >= band.from && cellValue('currentValue') <= band.to) {
        titleColor = band.color;
        break;
      }
    }
    options.title.style.color = titleColor;
  
    options.title.style.color = titleColor;
    Highcharts.chart(element, options);
  },
};

looker.plugins.visualizations.add(vis);
