const width = 1000;
const height = 1000;
const radius = Math.min(width, height * 2) / 2 - 60;
const innerRadius = radius / 1.8;
const labelRadius = radius + 20;
const degToRad = deg => deg * (Math.PI / 180);
let selectedGenre = null;

const svg = d3.select("svg")
  .append("g")
  .attr("transform", `translate(${width / 2}, ${height / 2})`);

const tooltip = d3.select("#tooltip");

const color = d3.scaleOrdinal()
  .range([
    "#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00",
    "#ffff33", "#a65628", "#f781bf", "#999999", "#66c2a5",
    "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f",
    "#e5c494", "#b3b3b3", "#1b9e77", "#d95f02", "#7570b3"
  ]);

d3.json("https://raw.githubusercontent.com/klertrat/project_infovis/e619a4b3518c7b18b2e4f78e948a1aa292b81842/df_long.json")
  .then(rawData => {
    const links = rawData.map(d => ({
      source: d["movie name"],
      target: d["genre"]
    }));

    const genreCounts = d3.rollups(links, v => v.length, d => d.target)
      .map(([genre, count]) => ({ genre, count }));

    const movieNames = Array.from(new Set(links.map(d => d.source)));
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

    const linkData = links.map((d, i) => {
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
      .style("fill", "#ccc")
      .style("text-anchor", "start")
      .text(d => d.movie);

    setTimeout(() => {
      svg.selectAll("text.movie-label textPath")
        .attr("startOffset", function(d) {
          const path = document.getElementById(d.id);
          if (!path) return "90%";
          const pathLength = path.getTotalLength();
          const avgCharWidth = 4;
          const textLength = d.movie.length * avgCharWidth;
          const offset = Math.max(pathLength - textLength, 0);
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
        const links = genreToLinks.get(genre) || [];

        svg.selectAll(".link").classed("active", l => links.includes(l));
        svg.selectAll(".movie-label").classed("active", l => links.some(link => link.movie === l.movie));
        svg.selectAll(".arc").classed("active", arc => arc.data.genre === genre);

        tooltip.style("display", "block")
          .html(`<strong>${genre}</strong><br>${links.length} movies`);
      });

    svg.selectAll(".movie-label")
  .on("mouseover", function(event, d) {
    if (selectedGenre) return;

    // Highlight all links for this movie
    const relatedLinks = linkData.filter(l => l.movie === d.movie);
    const connectedGenres = new Set(relatedLinks.map(l => l.genre));

    svg.selectAll(".link")
      .classed("highlight", l => l.movie === d.movie);

    svg.selectAll(".arc")
      .classed("highlight", arc => connectedGenres.has(arc.data.genre));

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
  });