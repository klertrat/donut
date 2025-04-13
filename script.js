const width = 800;
const height = 800;
const radius = Math.min(width, height * 2) / 2 - 50;
const innerRadius = radius / 2;
const labelRadius = radius + 20;
const degToRad = deg => deg * (Math.PI / 180);
let selectedGenre = null;
let selectedMovie = null;

const svg = d3.select("svg")
  .append("g")
  .attr("transform", `translate(${width / 2 + 20}, ${height / 2 - 60})`);

const tooltip = d3.select("#radar-tooltip");

const color = d3.scaleOrdinal()
  .range([
    "#5F8B4C", "#FF9A9A", "#FFDDAB", "#D6B84D", "#B03052",
    "#EBE8DB", "#FC80A5", "#B8D576", "#E0F47C", "#FFCDB2",
    "#F7CFD8", "#FFB433", "#FF8282", "#FAFFBC", "#ffd92f",
    "#e5c494", "#B4EBE6", "#C69359", "#BF4E3D", "#80CBC4"
  ]);

const sunburstSVG = d3.select("#sunburst");
const sunburstGroup = sunburstSVG.append("g")
  .attr("transform", "translate(350,350)");

let drawSunburst;

d3.json("https://raw.githubusercontent.com/klertrat/project_infovis/cd54eaf6bdc33b1a1400e4e4b4a76226474bb1b0/df_fulldesc.json")
  .then(rawData => {
    const links = rawData.flatMap(d => 
      (Array.isArray(d.genre) ? d.genre : [d.genre]).map(g => ({
        source: d["movie name"],
        target: g
      }))
    );

    const uniqueLinks = Array.from(
      new Map(links.map(d => [`${d.source}|${d.target}`, d])).values()
    );

    const genreCounts = d3.rollups(uniqueLinks, v => v.length, d => d.target)
      .map(([genre, count]) => ({ genre, count }));

    const movieNames = Array.from(new Set(uniqueLinks.map(d => d.source)));
    const genres = genreCounts.map(d => d.genre);
    color.domain(genres);

    const pie = d3.pie()
      .sort(null)
      .value(d => d.count)
      .startAngle(-Math.PI)
      .endAngle(0);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const pieData = pie(genreCounts);
    const genreAngle = {};

    const arcs = svg.selectAll(".arc")
      .data(pieData)
      .enter()
      .append("g")
      .attr("class", "arc");

    arcs.append("path")
      .attr("d", arc)
      .attr("fill", d => color(d.data.genre));

    arcs.append("text")
      .attr("transform", function(d) {
        const [x, y] = arc.centroid(d);
        const angle = (d.startAngle + d.endAngle) / 2;
        const degrees = angle * 180 / Math.PI;
        genreAngle[d.data.genre] = angle;
        return `translate(${x}, ${y}) rotate(${degrees + 90})`;
      })
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .text(d => d.data.genre)
      .style("font-size", "11px");

    const movieAngle = d3.scalePoint()
      .domain(movieNames)
      .range([degToRad(5), degToRad(175)]);

    const linkData = uniqueLinks.map((d, i) => {
      const sourceAngle = genreAngle[d.target];
      const targetAngle = movieAngle(d.source);
      return {
        id: `link-${i}`,
        movie: d.source,
        target: { angle: targetAngle, radius: labelRadius },
        source: { angle: sourceAngle, radius: innerRadius },
        genre: d.target
      };
    });

    const genreToLinks = d3.group(linkData, d => d.genre);

    const link = d3.linkRadial()
      .angle(d => d.angle)
      .radius(d => d.radius);

    svg.append("g")
      .attr("class", "links")
      .selectAll("path.link")
      .data(linkData)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("id", d => d.id)
      .attr("d", d => link({ source: d.source, target: d.target }))
      .attr("fill", "none");

    const movieLabelMap = new Map();
    linkData.forEach(d => {
      if (!movieLabelMap.has(d.movie) && d.target.angle >= 0 && d.target.angle <= Math.PI) {
        movieLabelMap.set(d.movie, d);
      }
    });

    const uniqueMovieLinks = Array.from(movieLabelMap.values());

    svg.append("g")
      .selectAll("text.movie-label")
      .data(uniqueMovieLinks)
      .enter()
      .append("text")
      .attr("class", "movie-label")
      .append("textPath")
      .attr("xlink:href", d => `#${d.id}`)
      .attr("startOffset", "0")
      .style("font-size", "9px")
      .style("fill", "#1e1e1e")
      .style("cursor", "pointer")
      .style("text-anchor", "start")
      .text(d => d.movie)
      .on("click", function(event, d) {
        event.stopPropagation();
        selectedGenre = null;
        selectedMovie = d.movie;

        const movieEntries = rawData.filter(m => m["movie name"] === d.movie);
        if (movieEntries.length) {
          const features = ['faces (0-5)', 'human figures (0-5)', 'man-made objects (0-5)', 'nature (0-5)', 'light (0-5)', 'aud. Info'];
          const averagedMovie = { "movie name": d.movie };
          features.forEach(f => {
            const sum = movieEntries.reduce((acc, row) => acc + (+row[f] || 0), 0);
            averagedMovie[f] = sum / movieEntries.length;
          });
          drawRadarChart(averagedMovie);
        }

        const relatedLinks = linkData.filter(l => l.movie === d.movie);
        const connectedGenres = new Set(relatedLinks.map(l => l.genre));

        svg.selectAll(".link").classed("active", l => l.movie === d.movie);
        svg.selectAll(".movie-label").classed("active", l => l.movie === d.movie);
        svg.selectAll(".arc").classed("active", arc => connectedGenres.has(arc.data.genre));

        tooltip.style("display", "block")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px")
          .html(`<strong>${d.movie}</strong><br>Movie selected`);
      });

    setTimeout(() => {
      svg.selectAll("text.movie-label textPath")
        .attr("startOffset", function(d) {
          const path = document.getElementById(d.id);
          if (!path) return "90%";
          const pathLength = path.getTotalLength();
          const avgCharWidth = 4;
          const textLength = d.movie.length * avgCharWidth;
          const offset = Math.max(pathLength - textLength - 15, 0);
          return `${offset}px`;
        });
    }, 0);

    svg.selectAll(".arc")
      .on("mouseover", function(event, d) {
        if (selectedGenre) return;
        const genre = d.data.genre;
        const links = genreToLinks.get(genre) || [];

        svg.selectAll(".link").classed("highlight", l => links.includes(l));
        svg.selectAll(".movie-label").classed("highlight", l => links.some(link => link.movie === l.movie));
        d3.select(this).classed("highlight", true);

        tooltip.style("display", "block")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px")
          .html(`<strong>${genre}</strong><br>${links.length} movies`);
      })
      .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        if (selectedGenre) return;
        tooltip.style("display", "none");
        svg.selectAll(".link, .movie-label, .arc").classed("highlight", false);
      })
      .on("click", function(event, d) {
        const genre = d.data.genre;

        if (selectedGenre === genre) {
          selectedGenre = null;
          svg.selectAll(".link, .movie-label, .arc").classed("active", false);
          tooltip.style("display", "none");
          return;
        }

        selectedGenre = genre;
        selectedMovie = null;

        const links = genreToLinks.get(genre) || [];

        svg.selectAll(".link").classed("active", l => links.includes(l));
        svg.selectAll(".movie-label").classed("active", l => links.some(link => link.movie === l.movie));
        svg.selectAll(".arc").classed("active", arc => arc.data.genre === genre);

        tooltip.style("display", "block")
          .html(`<strong>${genre}</strong><br>${links.length} movies`);

        const genreMovies = rawData.filter(movie => {
          const movieGenres = Array.isArray(movie.genre) ? movie.genre : [movie.genre];
          return movieGenres.includes(genre);
        });

        const features = ['faces (0-5)', 'human figures (0-5)', 'man-made objects (0-5)', 'nature (0-5)', 'light (0-5)', 'aud. Info'];
        const averaged = { "movie name": genre };

        features.forEach(f => {
          const values = genreMovies.map(m => +m[f] || 0);
          averaged[f] = values.length ? d3.mean(values) : 0;
        });

        drawRadarChart(averaged);
        drawSunburst(genre);
      });

    svg.selectAll(".movie-label")
      .on("mouseover", function(event, d) {
        if (selectedGenre) return;
        const relatedLinks = linkData.filter(l => l.movie === d.movie);
        const connectedGenres = new Set(relatedLinks.map(l => l.genre));

        svg.selectAll(".link").classed("highlight", l => l.movie === d.movie);
        svg.selectAll(".arc").classed("highlight", arc => connectedGenres.has(arc.data.genre));
        d3.select(this).classed("highlight", true);

        tooltip.style("display", "block")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px")
          .text(d.movie);
      })
      .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        if (selectedGenre) return;
        tooltip.style("display", "none");
        svg.selectAll(".link, .movie-label, .arc").classed("highlight", false);
      });

    // Sunburst data creation
    const genreMap = new Map();
    rawData.forEach(d => {
      const genres = Array.isArray(d.genre) ? d.genre : [d.genre];
      const movie = d["movie name"];
      const file = d["file name"];
      genres.forEach(genre => {
        if (!genreMap.has(genre)) genreMap.set(genre, new Map());
        const movieMap = genreMap.get(genre);
        if (!movieMap.has(movie)) movieMap.set(movie, []);
        movieMap.get(movie).push({ name: file });
      });
    });

    const structuredData = {};
    genreMap.forEach((movies, genre) => {
      structuredData[genre] = {
        name: "root",
        children: [{
          name: genre,
          children: Array.from(movies.entries()).map(([movie, files]) => ({
            name: movie,
            children: files
          }))
        }]
      };
    });

    drawSunburst = function(selectedGenre) {
      sunburstGroup.selectAll("*").remove();

      const radius = 450;
      const partition = d3.partition().size([2 * Math.PI, radius]);
      const root = d3.hierarchy(structuredData[selectedGenre])
        .sum(d => d.children ? 0 : 1);

      partition(root);

      const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => {
          if (d.depth === 1) return 0;
          if (d.depth === 2) return radius * 0.2;
          return radius * 0.5;
        })
        .outerRadius(d => {
          if (d.depth === 1) return radius * 0.2;
          if (d.depth === 2) return radius * 0.5;
          return radius * 0.8;
        });

      sunburstGroup.selectAll("path")
  .data(root.descendants().filter(d => d.depth > 0))
  .enter()
  .append("path")
  .attr("d", arc)
  .attr("class", "sunburst-segment")
  .attr("fill", d => {
    if (d.depth === 1) return color(d.data.name);
    if (d.depth === 2) return d3.color(color(d.parent.data.name)).brighter(0.5);
    if (d.depth === 3) return d3.color(color(d.parent.parent.data.name)).brighter(1.1);
  })
  .attr("stroke", "#303030")
  .attr("stroke-width", 0.5)
  .attr("opacity", 0.8) // ← Set default opacity
  


      sunburstGroup.selectAll("text")
  .data(root.descendants().filter(d => d.depth > 1))
  .enter()
  .append("text")
  .attr("class", d => (d.depth === 2 || d.depth === 3) ? "sunburst-label hoverable" : "sunburst-label")
  .attr("transform", d => {
    const angle = ((d.x0 + d.x1) / 2) * 180 / Math.PI - 90;
    const r = d.depth === 2 ? radius * 0.35 : radius * 0.65;
    const flip = angle > 90 ? 180 : 0;
    return `rotate(${angle}) translate(${r},0) rotate(${flip})`;
  })
  .attr("text-anchor", "middle")
  .attr("alignment-baseline", "middle")
  .text(d => (d.x1 - d.x0 > 0.04) ? d.data.name : "")
  .on("mouseover", function (event, d) {
    if (d.depth === 3) {
      d3.select(this).attr("font-size", "12px").attr("font-weight", "bold");
    }
  })
  .on("mouseout", function (event, d) {
    if (d.depth === 3) {
      d3.select(this).attr("font-size", "9px").attr("font-weight", null);
    }
  })
  .on("click", function (event, d) {
        console.log("Clicked depth:", d.depth, d.data.name);
    if (d.depth === 3) {
      const fileName = d.data.name;
      const fileEntry = rawData.find(row => row["file name"] === fileName);
      if (fileEntry) {
        drawRadarChart({
          "movie name": `${fileEntry["movie name"]} (${fileEntry["file name"]})`,
          "faces (0-5)": +fileEntry["faces (0-5)"] || 0,
          "human figures (0-5)": +fileEntry["human figures (0-5)"] || 0,
          "man-made objects (0-5)": +fileEntry["man-made objects (0-5)"] || 0,
          "nature (0-5)": +fileEntry["nature (0-5)"] || 0,
          "light (0-5)": +fileEntry["light (0-5)"] || 0,
          "aud. Info": +fileEntry["aud. Info"] || 0
        });
      }
    } else if (d.depth === 2) {
  const movieName = d.data.name;
  const fileList = d.children.map(child => child.data.name);

  const movieEntries = rawData.filter(row => fileList.includes(row["file name"]));

  if (movieEntries.length) {
    const features = [
      'faces (0-5)',
      'human figures (0-5)',
      'man-made objects (0-5)',
      'nature (0-5)',
      'light (0-5)',
      'aud. Info'
    ];

    const averagedMovie = { 
      "movie name": `${movieName} (${movieEntries.length} files)` 
    };

    features.forEach(f => {
      const sum = movieEntries.reduce((acc, row) => acc + (+row[f] || 0), 0);
      averagedMovie[f] = sum / movieEntries.length;
    });

    drawRadarChart(averagedMovie);
  }
}
  });

      sunburstGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("class", "center-label")
        .text(selectedGenre);
    };

    drawSunburst(genres[0]);
    drawRadarChart({
      "movie name": "No selection",
      "faces (0-5)": 0,
      "human figures (0-5)": 0,
      "man-made objects (0-5)": 0,
      "nature (0-5)": 0,
      "light (0-5)": 0,
      "aud. Info": 0
    });
  })
  .catch(err => console.error("Error loading data:", err));

// Radar chart function remains unchanged from your original
function drawRadarChart(movie) {
  const features = ['faces (0-5)', 'human figures (0-5)', 'man-made objects (0-5)', 'nature (0-5)', 'light (0-5)', 'aud. Info'];
  const radarData = features.map(f => ({ axis: f, value: +movie[f] || 0 }));

  const rsvg = d3.select("#radar");
  rsvg.selectAll("*").remove();

  const r = 100;
  const levels = 5;
  const center = { x: 100, y: 100 };
  const angleSlice = (Math.PI * 2) / features.length;

  const radarGroup = rsvg.append("g").attr("transform", `translate(${center.x + 100}, ${center.y})`);

  for (let lvl = 1; lvl <= levels; lvl++) {
    const factor = r * (lvl / levels);
    radarGroup.selectAll(".levels")
      .data(features)
      .enter()
      .append("line")
      .attr("x1", (d, i) => factor * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y1", (d, i) => factor * Math.sin(angleSlice * i - Math.PI / 2))
      .attr("x2", (d, i) => factor * Math.cos(angleSlice * (i + 1) - Math.PI / 2))
      .attr("y2", (d, i) => factor * Math.sin(angleSlice * (i + 1) - Math.PI / 2))
      .style("stroke", "#ccc")
      .style("stroke-width", "0.5px");
  }

  radarGroup.selectAll(".axis")
    .data(radarData)
    .enter()
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", (d, i) => r * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("y2", (d, i) => r * Math.sin(angleSlice * i - Math.PI / 2))
    .attr("stroke", "#888");

  radarGroup.selectAll(".label")
    .data(radarData)
    .enter()
    .append("text")
    .attr("x", (d, i) => (r + 12) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("y", (d, i) => (r + 12) * Math.sin(angleSlice * i - Math.PI / 2))
    .text(d => d.axis)
    .style("font-size", "10px")
    .attr("text-anchor", "middle");

  radarData.push(radarData[0]);
  const radarLine = d3.lineRadial()
    .radius(d => (d.value / 5) * r)
    .angle((d, i) => i * angleSlice);

  radarGroup.append("path")
    .datum(radarData)
    .attr("d", radarLine)
    .attr("fill", "#ff6680aa")
    .attr("stroke", "#ff3366")
    .attr("stroke-width", 2);

  radarGroup.selectAll(".dot")
    .data(radarData.slice(0, -1))
    .enter()
    .append("circle")
    .attr("cx", (d, i) => (d.value / 5) * r * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("cy", (d, i) => (d.value / 5) * r * Math.sin(angleSlice * i - Math.PI / 2))
    .attr("r", 4)
    .attr("fill", "#ff3366")
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      d3.select("#radar-tooltip")
        .style("display", "block")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px")
        .html(`<strong>${d.axis}</strong>: ${d.value.toFixed(2)}`);
    })
    .on("mousemove", event => {
      d3.select("#radar-tooltip")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", () => {
      d3.select("#radar-tooltip").style("display", "none");
    });

  radarGroup.append("text")
    .attr("x", 0)
    .attr("y", -r - 30)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .text(movie["movie name"]);
}