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
    gallery.append(card);
  }

  galleries.forEach(async (gallery) => {
    const { data, error } = await client
      .from("projects")
      .select("id, title, summary, body, image_url")
      .eq("school_id", gallery.dataset.schoolGallery)
      .order("created_at", { ascending: false });
    if (error || !data?.length) return;
    data.forEach((project) => addProject(gallery, project));
    const emptyState = gallery.parentElement.querySelector(".empty-projects");
    if (emptyState) emptyState.hidden = true;
  });
})();
