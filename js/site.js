(() => {
  const config = window.ROBOTICA_CONFIG;
  const supabaseApi = window.supabase;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseApi) return;

  const client = supabaseApi.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const galleries = document.querySelectorAll("[data-school-gallery]");

  function addProject(gallery, project) {
    // Cria o container principal do card
    const card = document.createElement("article");
    card.className = "published-project smart-card";

    // Cria a div lateral da imagem
    if (project.image_url && project.image_url.startsWith("https://")) {
      const imageWrapper = document.createElement("div");
      imageWrapper.className = "smart-card-image";
      
      const image = document.createElement("img");
      image.src = project.image_url;
      image.alt = "Imagem do projeto " + project.title;
      image.loading = "lazy";
      
      imageWrapper.append(image);
      card.append(imageWrapper);
    }

    // Cria a div lateral do conteúdo (textos)
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "smart-card-content";

    const title = document.createElement("h3");
    title.textContent = project.title;
    
    const summary = document.createElement("p");
    summary.className = "published-summary";
    // Deixa o resumo em negrito ou destacado
    summary.style.fontWeight = "600"; 
    summary.style.marginBottom = "1rem";
    summary.textContent = project.summary;
    
    const body = document.createElement("p");
    // Como o texto é longo, o CSS vai cuidar dos parágrafos
    body.innerHTML = project.body.replace(/\n/g, '<br>'); 
    
    contentWrapper.append(title, summary, body);

    // Adiciona o botão de código se existir
    if (project.code_url) {
      const codeLink = document.createElement("a");
      codeLink.href = project.code_url;
      codeLink.target = "_blank";
      codeLink.rel = "noopener noreferrer";
      codeLink.className = "button button-dark";
      codeLink.style.display = "inline-block";
      codeLink.style.marginTop = "1.5rem";
      codeLink.innerHTML = 'Acessar código <span aria-hidden="true">↗</span>';
      contentWrapper.append(codeLink);
    }

    card.append(contentWrapper);
    gallery.append(card);
  }

  galleries.forEach(async (gallery) => {
    // Limpa a mensagem de "Os projetos aparecerão aqui" se houver projetos
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
