(() => {
  const config = window.ROBOTICA_CONFIG;
  const supabaseApi = window.supabase;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseApi) return;

  const client = supabaseApi.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const galleries = document.querySelectorAll("[data-school-gallery]");

  function addProject(gallery, project) {
    const card = document.createElement("article");
    card.className = "published-project";
    
    if (project.image_url && project.image_url.startsWith("https://")) {
      const image = document.createElement("img");
      image.src = project.image_url;
      image.alt = "Imagem do projeto " + project.title;
      image.loading = "lazy";
      card.append(image);
    }
    
    const title = document.createElement("h3");
    title.textContent = project.title;
    const summary = document.createElement("p");
    summary.className = "published-summary";
    summary.textContent = project.summary;
    const body = document.createElement("p");
    body.textContent = project.body;
    card.append(title, summary, body);

    // Adiciona o botão para acessar o código se o link existir
    if (project.code_url) {
      const codeLink = document.createElement("a");
      codeLink.href = project.code_url;
      codeLink.target = "_blank";
      codeLink.rel = "noopener noreferrer";
      codeLink.className = "text-link";
      codeLink.style.display = "inline-block";
      codeLink.style.marginTop = "1rem";
      codeLink.innerHTML = 'Acessar código <span aria-hidden="true">↗</span>';
      card.append(codeLink);
    }

    gallery.append(card);
  }

  galleries.forEach(async (gallery) => {
    const { data, error } = await client
      .from("projects")
      .select("id, title, summary, body, image_url, code_url") 
      .eq("school_id", gallery.dataset.schoolGallery)
      .order("created_at", { ascending: false });
      
    if (error || !data?.length) return;
    
    data.forEach((project) => addProject(gallery, project));
    
    const emptyState = gallery.parentElement.querySelector(".empty-projects");
    if (emptyState) emptyState.hidden = true;
  });
})();
