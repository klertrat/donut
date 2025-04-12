const width = 900;
    const height = 900;
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
        "#5F8B4C", "#FF9A9A", "#FFDDAB", "#D6B84D", "#B03052",
        "#EBE8DB", "#FC80A5", "#B8D576", "#E0F47C", "#FFCDB2",
        "#F7CFD8", "#FFB433", "#FF8282", "#FAFFBC", "#ffd92f",
        "#e5c494", "#B4EBE6", "#C69359", "#BF4E3D", "#80CBC4"
      ]);

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
              const offset = Math.max(pathLength - textLength - 15, 0);
              return `${offset}px`;
            });
        }, 0);

        // Hover + click logic same as before
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
      });