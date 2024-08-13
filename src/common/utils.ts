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
        message: `This visualization requires ${min === max ? "exactly" : "at least"
          } ${min} ${noun.toLowerCase()}${min === 1 ? "" : "s"}.`,
        group,
      });
      return false;
    }
    if (count > max) {
      vis.addError({
        title: `Too Many ${noun}s`,
        message: `This visualization requires ${min === max ? "exactly" : "no more than"
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
    return { dataMin: 0 - Math.abs(dataMin), dataMax: dataMax };
  } else {
    return extremes;
  }
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
      name: dimension?.name,
      type: dimension?.type,
      title: dimension.label_short.trim().replace(/\r?\n/g, ""),
    };
  });
  let measures = queryResponse.fields.measures.map((measure) => {
    return {
      name: measure.name,
      type: measure.type,
      title: measure.view_label.trim().replace(/\r?\n/g, ""),
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
      timeSeries[0]?.type,
      datum[timeSeries[0]?.name]?.value
    );
    if (!maxTime || timePoint > maxTime) {
      maxTime = timePoint;
      maxIndex = i;
      console.log(datum[timeSeries[0]?.name]);
    } else if (!minTime || timePoint < minTime) {
      minTime = timePoint;
    }
  });
  return [minTime, maxTime, maxIndex];
};

export const gaugeOptions = (
  minValue = 0,
  maxValue = 1000,
  latest,
  fontFamily,
  title,
  subtitle
) => {
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
        tooltip: {
          enabled: false,
        },
        dataLabels: {
          enabled: false,
        },
      },
    },
    title: {
      text: title,
      style: {
        color: "#007CA0",
        fontSize: "24px",
        fontFamily: fontFamily,
      },
    },
    subtitle: {
      text: subtitle,
    },
    legend: {
      enabled: false,
    },
    pane: {
      startAngle: -150,
      endAngle: 150,
      background: [
        {
          backgroundColor: "white",
          borderWidth: 0,
        },
      ],
    },

    // the value axis
    yAxis: {
      min: minValue,
      max: maxValue,

      minorTickInterval: null,
      // minorTickColor: "#D2DEE3",
      tickColor: "#D2DEE3",
      tickPosition: "outside",
      // tickPositions: [minValue],
      // tickAmount: 1,
      tickWidth: 1,
      tickLength: 1,
      labels: {
        distance: 25,
        style: {
          color: "#768D95",
          fontFamily: fontFamily,
        },
      },
    },
    tooltip: {
      enabled: false,
    },
    series: [
      {
        type: "gauge",
        name: "Value",
        color: "#007CA0",
        //@ts-ignore
        data: [
          {
            y: latest,
            name: "Value",
            color: "#007CA0",
          },
        ],
        label: {
          enabled: false,
        },
        dial: {
          backgroundColor: "#007CA0",
          borderColor: "#007CA0",
          baseWidth: 3,
          topWidth: 1,
          baseLength: "97%",
        },
        pivot: {
          backgroundColor: "#007CA0",
          borderColor: "#007CA0",
        },
      },
    ],
  };
};


export const flexibleGaugeOptions = () => {
  return {
    chart: {
      type: 'gauge',
      plotBackgroundColor: null,
      plotBackgroundImage: null,
      plotBorderWidth: 0,
      plotShadow: false,
    },
    title: {
      style: {
        
        fontSize: '30px', // Font size for the title
        verticalAlign: 'top' // Align to the top
      },
      y: 40 // Adjust vertical position
    },
    subtitle: {
      style: {
        color: '#D3D3D3', // Light gray color for subtitle
        fontSize: '16px', // Font size for the subtitle
        verticalAlign: 'top' // Align to the top
      },
      y: 70 // Adjust vertical position
    },
    pane: {
      startAngle: -90,
      endAngle: 90,
      size: '150%',
      background: [{
        backgroundColor: null, // No background
        borderWidth: 0,
        outerRadius: '100%'
      }],
      center: ['50%', '80%'], // Center gauge
    },

    yAxis: {
      lineWidth: 0,
      tickPositions: [],
      labels: {
        enabled: false // Hide labels for a cleaner look
      },

    },
    tooltip: {
      enabled: false
    },
    series: [{
      tooltip: {
        enabled: false
      },
      dial: {
        radius: '105%',
        baseLength: '10%',
        baseWidth: 10,
        rearLength: '10%',
      },
      dataLabels: {
        enabled: false, // Hide data labels
      }
    }],


  }
}