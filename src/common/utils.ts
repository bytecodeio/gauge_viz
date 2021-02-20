import {
  VisConfig,
  VisQueryResponse,
  VisualizationDefinition,
  VisDimension,
  VisMeasure,
  VisData,
  MassBalanceChartMap,
  MassBalanceMeasures,
} from "./types";
import Highcharts = require("highcharts");

export const formatType = (valueFormat: string, value: any): number => {
  if (value === 0) return 0;
  if (!value || !valueFormat) return null;
  switch (valueFormat) {
    case "date_time":
    case "date_date":
    case "date_month":
    case "date_quarter":
    case "date_week":
    case "date_year":
      return new Date(value).valueOf();
    default:
      return parseInt(value);
  }
};

export enum xAxisLevels {
  Hours,
  Days,
  Months,
  Years,
}

interface CustomXAxisOptions extends Omit<Highcharts.XAxisOptions, "labels"> {
  labels: Highcharts.XAxisOptions["labels"] & {
    name?: string;
    type?: string;
    title?: {
      text?: string;
    };
  };
}

const defaultXAxisMap: CustomXAxisOptions = {
  type: "datetime",
  startOnTick: true,
  minorTicks: false,
  gridLineWidth: 1,
  tickPixelInterval: 50,
  labels: {
    enabled: true,
    formatter: function () {
      return Highcharts && Highcharts.dateFormat("%Y-%m-%d", this.value);
    },
    title: {
      text: null,
    },
    rotation: -45,
  },
  showLastLabel: true,
};

export const xAxisMap: {
  [x in xAxisLevels]: CustomXAxisOptions[];
} = {
  [xAxisLevels.Hours]: [
    {
      ...defaultXAxisMap,
      units: [
        ["minute", [1, 2, 5, 10, 15, 30]],
        ["hour", [1, 2, 3, 4, 5, 6, 8, 12, 24]],
        ["day", [1, 2, 3, 4, 5, 6]],
      ],
    },
  ],
  [xAxisLevels.Days]: [
    {
      ...defaultXAxisMap,
      units: [
        ["hour", [1, 2, 3, 4, 5, 6, 8, 12, 24]],
        ["day", [1, 2, 3, 4, 5, 8, 12, 20, 30, 31]],
        ["month", [1, 2, 3, 4]],
      ],
    },
  ],
  [xAxisLevels.Months]: [
    {
      ...defaultXAxisMap,
      units: [
        ["minute", [1, 2, 5, 10, 15, 30]],
        ["hour", [1, 2, 3, 4, 6, 8, 12, 24]],
        ["day", [1, 2, 3, 4, 5, 6, 10, 15, 20, 30, 31]],
      ],
    },
  ],
  [xAxisLevels.Years]: [
    {
      ...defaultXAxisMap,
      minorTicks: false,
      units: [
        ["minute", [1, 2, 5, 10, 15, 30]],
        ["hour", [1, 2, 3, 4, 6, 8, 12, 24]],
        ["day", [1, 2, 3, 4, 5, 6]],
        ["month", [1, 3, 6]],
      ],
    },
  ],
};

export const getTimeSeriesXAxis = (
  dateMax: number,
  dateMin: number
): Highcharts.XAxisOptions[] => {
  const day = 24 * 60 * 60 * 1000; // hours * minutes * seconds * milliseconds

  const daysBetween = Math.round(Math.abs((dateMin - dateMax) / day));

  if (daysBetween < 5) {
    // hours is appropriate
    return xAxisMap[xAxisLevels.Hours] as Highcharts.XAxisOptions[];
  } else if (daysBetween < 30) {
    // days is appropriate
    return xAxisMap[xAxisLevels.Days] as Highcharts.XAxisOptions[];
  } else if (daysBetween < 90) {
    // months is appropriate
    return (xAxisMap[
      xAxisLevels.Months
    ] as unknown) as Highcharts.XAxisOptions[];
  } else {
    // years is appropriate
    return (xAxisMap[
      xAxisLevels.Years
    ] as unknown) as Highcharts.XAxisOptions[];
  }
};

export const handleErrors = (
  vis: VisualizationDefinition,
  res: VisQueryResponse,
  options: VisConfig
) => {
  const check = (
    group: string,
    noun: string,
    count: number,
    min: number,
    max: number
  ): boolean => {
    if (!vis.addError || !vis.clearErrors) return false;
    if (count < min) {
      vis.addError({
        title: `Not Enough ${noun}s`,
        message: `This visualization requires ${
          min === max ? "exactly" : "at least"
        } ${min} ${noun.toLowerCase()}${min === 1 ? "" : "s"}.`,
        group,
      });
      return false;
    }
    if (count > max) {
      vis.addError({
        title: `Too Many ${noun}s`,
        message: `This visualization requires ${
          min === max ? "exactly" : "no more than"
        } ${max} ${noun.toLowerCase()}${min === 1 ? "" : "s"}.`,
        group,
      });
      return false;
    }
    vis.clearErrors(group);
    return true;
  };

  const { pivots, dimensions, measure_like: measures } = res.fields;

  return (
    check(
      "pivot-req",
      "Pivot",
      pivots.length,
      options.min_pivots,
      options.max_pivots
    ) &&
    check(
      "dim-req",
      "Dimension",
      dimensions.length,
      options.min_dimensions,
      options.max_dimensions
    ) &&
    check(
      "mes-req",
      "Measure",
      measures.length,
      options.min_measures,
      options.max_measures
    )
  );
};

const calculateExtremes = (extremes) => {
  const { dataMin, dataMax } = extremes;
  if (dataMin && dataMax && dataMin === dataMax) {
    // Single sensor value or sensors readings all same
    // Set reasonable min for range where values may be negative
    return {dataMin: 0 - Math.abs(dataMin), dataMax: dataMax};
  } else {
    return extremes;
  }
}

/**
 * Generates positions for y axis given a certain number of ticks. Pass it the function's 'this' and # of intervals
 * @param extremes The 'this' value for a chart - at least needs {dataMin, dataMax}
 * @param intervals How many y-axis ticks to generate positions for
 */
export const getYAxisTicks = function (extremes, intervals = 5) {
  let positions: number[] = [];

  //@ts-ignore
  const { dataMin, dataMax } = calculateExtremes(extremes);
  let tick: number = Math.floor(dataMin);
  let increment: number = Math.ceil(dataMax - dataMin) / intervals;
  // Rounding normal increment depends on whether there is a real range
  // if not generate increment on data min
  const [whole, decimals] =
    increment === 0 ? getNumberOfDigits(dataMin) : getNumberOfDigits(increment);

  if (increment === 0) {
    // Calc rounded increment
    if (whole >= 2) {
      increment = Math.pow(10, whole - 1);
    } else if (whole >= 0 && decimals === 0) {
      increment = 5;
    } else {
      increment = Math.pow(0.1, decimals);
    }
    tick = Math.floor(dataMin) - increment * 2;
  } else {
    if (whole >= 2) {
      const sigFig = Math.pow(10, whole - 1);
      increment = Math.ceil(increment / sigFig) * sigFig;
      tick = Math.floor(dataMin / sigFig) * sigFig;
    } else if (whole >= 0 && decimals === 0) {
      increment = 2;
    } else {
      positions.push(Math.floor(dataMin));
      positions.push(Math.ceil(dataMax));
      return positions;
    }
  }
  if (dataMax !== null && dataMin !== null) {
    for (tick; tick - increment <= dataMax; tick += increment) {
      positions.push(tick);
    }
  }

  return positions;
};

export const getNumberOfDigits = (number: number | null): [number, number] => {
  if (!number) return [0, 0];
  const splitNumber = number.toString().split(".");
  let decimals = splitNumber.length > 1 ? splitNumber[1].length : 0;
  return [splitNumber[0].length, decimals];
};

/**
 * Returns tuple in the order [pivotKey[], dimensions[], measures[]]
 * @param queryResponse
 */
export const processQueryResponse = (
  queryResponse: VisQueryResponse
): [string[], VisDimension[], VisMeasure[]] => {
  let pivots = queryResponse.pivots?.map((pivot) => pivot.key);

  let dimensions = queryResponse.fields.dimensions.map((dimension) => {
    return {
      name: dimension.name,
      type: dimension.type,
      title: dimension.label_short.trim().replace(/\r?\n/g, ''),
    };
  });
  let measures = queryResponse.fields.measures.map((measure) => {
    return {
      name: measure.name,
      type: measure.type,
      title: measure.view_label.trim().replace(/\r?\n/g, ''),
    };
  });

  return [pivots, dimensions, measures];
};

export const getMinMaxDatetimes = (
  data: VisData,
  timeSeries: VisDimension[]
): [number, number, number] => {
  let minTime, maxTime, maxIndex;
  data.map((datum, i) => {
    let timePoint = formatType(
      timeSeries[0].type,
      datum[timeSeries[0].name].value
    );
    if (!maxTime || timePoint > maxTime) {
      maxTime = timePoint;
      maxIndex = i
    } else if (!minTime || timePoint < minTime) {
      minTime = timePoint;
    }
  });
  return [minTime, maxTime, maxIndex];
};

export const gaugeOptions = (minValue = 0, maxValue = 1000, latest, fontFamily, title) =>  {
  return {
  chart: {
    type: "gauge",
    plotBackgroundColor: null,
    plotBackgroundImage: null,
    plotBorderWidth: 0,
    plotShadow: false,
  },
  credits: {
    enabled: false,
  },
  plotOptions: {
    series: {
      dataLabels: {
        enabled: false,
      },
    },
  },
  title: {
    text: title,
    style:  {
      "color": "#007CA0", 
      "fontSize": "24px",
      "fontFamily": fontFamily 
    },
  },
  legend: {
    enabled: false,
  },
  pane: {
    startAngle: -150,
    endAngle: 150,
    background: [{
        backgroundColor: 'white',
        borderWidth: 0,
        }]

  },

  // the value axis
  yAxis: {
    min: minValue,
    max: maxValue,

    minorTicks: false,
     minorTickColor: "#D2DEE3",
     tickColor: "#D2DEE3",
    labels: {
      distance: 25,
      style: {
        color: "#768D95",
        fontFamily: fontFamily 
      }
  
    },

    plotBands: [
      {
        from: minValue,
        to: maxValue,
        color: "#D2DEE3",
        thickness: "30%",
      },
    ],
  },

  series: [
    {
      type: "gauge",
      name: "Value",
      color: "#007CA0",
      //@ts-ignore
      data: [{
          y: latest,
          name: "Value",
          color: "#007CA0"
      }],
      label: {
        enabled: false,
      },
      dial: {
        backgroundColor: "#007CA0",
        borderColor: "#007CA0",
        baseWidth: 3,
        topWidth: 1,
        baseLength: "97%"
      },
      pivot: {
        backgroundColor: "#007CA0",
        borderColor: "#007CA0",
       
      }
    },
  ],
};
}
