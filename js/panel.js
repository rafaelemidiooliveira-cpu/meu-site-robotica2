(() => {
  const config = window.ROBOTICA_CONFIG;
  const supabaseApi = window.supabase;
  const notice = document.querySelector("#connection-notice");
  const loginForm = document.querySelector("#login-form");
  const signupForm = document.querySelector("#signup-form");
  const signupRoleNotice = document.querySelector("#signup-role-notice");
  const workspace = document.querySelector("#workspace");
  const proposalForm = document.querySelector("#proposal-form");
  const workspaceMessage = document.querySelector("#workspace-message");

  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseApi) {
    notice.textContent = "O acesso ainda não foi conectado ao banco de dados. Configure o Supabase seguindo as instruções do projeto.";
    [loginForm, signupForm].forEach((form) => form.querySelectorAll("input, button").forEach((control) => { control.disabled = true; }));
    return;
  }

  const client = supabaseApi.createClient(config.supabaseUrl, config.supabaseAnonKey);
  let currentUser;
  let currentRole;

  function setMessage(message, isError = false) {
    workspaceMessage.textContent = message;
    workspaceMessage.classList.toggle("is-error", isError);
  }

  function setField(id, value) {
    document.querySelector(`#${id}`).value = value || "";
  }

  function clearEditor() {
    proposalForm.reset();
    setField("proposal-id", "");
    setField("target-project-id", "");
    setField("published-project-id", "");
    setField("project-image-url", "");
    setField("project-code-url", "");
    document.querySelector("#editor-eyebrow").textContent = "NOVO PROJETO";
    document.querySelector("#cancel-edit-button").hidden = true;
    if (currentRole && currentRole !== "visitor") {
      proposalForm.querySelector("button[type=submit]").textContent = currentRole === "admin" ? "Publicar agora ↗" : "Enviar para revisão ↗";
    }
  }

  function fillEditor(fields) {
    setField("proposal-id", fields.proposalId || "");
    setField("target-project-id", fields.targetProjectId || "");
    setField("published-project-id", fields.publishedProjectId || "");
    setField("project-school", fields.schoolId);
    setField("project-title", fields.title);
    setField("project-summary", fields.summary);
    setField("project-body", fields.body);
    setField("project-image-url", fields.imageUrl);
    setField("project-code-url", fields.codeUrl);
    document.querySelector("#editor-eyebrow").textContent = fields.eyebrow;
    document.querySelector("#cancel-edit-button").hidden = !fields.showCancel;
    if (fields.submitLabel) {
      proposalForm.querySelector("button[type=submit]").textContent = fields.submitLabel;
    }
    proposalForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadWorkspace() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    currentUser = user;
    const { data: profile, error } = await client.from("profiles").select("role").eq("id", user.id).single();
    if (error || !profile) {
      notice.hidden = false;
      notice.textContent = "Não foi possível carregar seu perfil. Confira a configuração do banco.";
      return;
    }
    currentRole = profile.role;
    notice.hidden = true;
    loginForm.hidden = true;
    signupForm.hidden = true;
    workspace.hidden = false;
    document.querySelector("#account-label").textContent = currentRole === "admin" ? "Painel do administrador" : currentRole === "student" ? "Painel do estudante" : "Acesso de visitante";
    proposalForm.hidden = currentRole === "visitor";
    document.querySelector("#visitor-message").hidden = currentRole !== "visitor";
    if (currentRole !== "visitor") {
      proposalForm.querySelector("button[type=submit]").textContent = currentRole === "admin" ? "Publicar agora ↗" : "Enviar para revisão ↗";
    }
    document.querySelector("#review-section").hidden = currentRole !== "admin";
    document.querySelector("#published-projects").hidden = currentRole !== "admin";
    document.querySelector("#my-projects").hidden = currentRole !== "student";
    document.querySelector("#my-proposals").hidden = currentRole !== "student";
    await Promise.all([
      loadMyProjects(),
      loadMyProposals(),
      currentRole === "admin" ? loadReviews() : Promise.resolve(),
      currentRole === "admin" ? loadPublishedProjects() : Promise.resolve()
    ]);
  }

  async function loadMyProjects() {
    if (currentRole !== "student") return;
    const { data } = await client.from("projects").select("*").eq("author_id", currentUser.id).order("created_at", { ascending: false });
    const list = document.querySelector("#my-project-list");
    list.replaceChildren();
    (data || []).forEach((project) => {
      const row = document.createElement("div");
      row.className = "dashboard-row";
      const title = document.createElement("span");
      title.textContent = project.title;
      const button = document.createElement("button");
      button.className = "text-button";
      button.type = "button";
      button.textContent = "Propor edição";
      button.addEventListener("click", () => {
        fillEditor({
          targetProjectId: project.id,
          schoolId: project.school_id,
          title: project.title,
          summary: project.summary,
          body: project.body,
          imageUrl: project.image_url,
          codeUrl: project.code_url,
          eyebrow: "EDIÇÃO PARA APROVAÇÃO",
          showCancel: true,
          submitLabel: "Enviar para revisão ↗"
        });
      });
      row.append(title, button);
      list.append(row);
    });
    if (!data?.length) list.textContent = "Seus projetos publicados aparecerão aqui.";
  }

  async function loadMyProposals() {
    if (currentRole !== "student") return;
    const { data } = await client.from("project_proposals").select("*").eq("author_id", currentUser.id).order("created_at", { ascending: false });
    const list = document.querySelector("#my-proposal-list");
    list.replaceChildren();
    (data || []).forEach((proposal) => {
      const row = document.createElement("div");
      row.className = "dashboard-row";
      const label = document.createElement("span");
      const status = proposal.status === "pending" ? "aguardando revisão" : proposal.status === "approved" ? "aprovado" : "precisa de ajustes";
      label.textContent = `${proposal.title} · ${status}`;
      row.append(label);
      if (proposal.status === "pending") {
        const button = document.createElement("button");
        button.className = "text-button";
        button.type = "button";
        button.textContent = "Editar proposta";
        button.addEventListener("click", () => {
          fillEditor({
            proposalId: proposal.id,
            targetProjectId: proposal.target_project_id,
            schoolId: proposal.school_id,
            title: proposal.title,
            summary: proposal.summary,
            body: proposal.body,
            imageUrl: proposal.image_url,
            codeUrl: proposal.code_url,
            eyebrow: "EDITAR PROPOSTA PENDENTE",
            showCancel: true,
            submitLabel: "Enviar para revisão ↗"
          });
        });
        row.append(button);
      }
      list.append(row);
    });
    if (!data?.length) list.textContent = "Você ainda não enviou propostas.";
  }

  function schoolLabel(schoolId) {
    return schoolId === "ceep" ? "CEEP Ozório Gonçalves Nogueira" : "Escola Estadual do Bella Vista";
  }

  async function loadPublishedProjects() {
    if (currentRole !== "admin") return;
    const list = document.querySelector("#published-project-list");
    const { data, error } = await client.from("projects").select("*").order("created_at", { ascending: false });
    list.replaceChildren();
    if (error) {
      list.textContent = "Não foi possível carregar os projetos publicados.";
      return;
    }
    if (!data?.length) {
      list.textContent = "Ainda não há projetos publicados.";
      return;
    }
    data.forEach((project) => {
      const row = document.createElement("div");
      row.className = "dashboard-row";
      const title = document.createElement("span");
      title.textContent = `${project.title} · ${schoolLabel(project.school_id)}`;
      const actions = document.createElement("div");
      actions.className = "dashboard-actions";
      const editButton = document.createElement("button");
      editButton.className = "text-button";
      editButton.type = "button";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", () => {
        fillEditor({
          publishedProjectId: project.id,
          schoolId: project.school_id,
          title: project.title,
          summary: project.summary,
          body: project.body,
          imageUrl: project.image_url,
          codeUrl: project.code_url,
          eyebrow: "EDITAR PROJETO PUBLICADO",
          showCancel: true,
          submitLabel: "Salvar alterações ↗"
        });
      });
      const deleteButton = document.createElement("button");
      deleteButton.className = "text-button text-button-danger";
      deleteButton.type = "button";
      deleteButton.textContent = "Excluir";
      deleteButton.addEventListener("click", async () => {
        const confirmed = window.confirm(`Excluir o projeto "${project.title}"? Ele sairá do site imediatamente.`);
        if (!confirmed) return;
        deleteButton.disabled = true;
        const { error: deleteError } = await client.from("projects").delete().eq("id", project.id);
        if (deleteError) {
          setMessage(deleteError.message, true);
          deleteButton.disabled = false;
          return;
        }
        setMessage("Projeto excluído do site.");
        if (document.querySelector("#published-project-id").value === project.id) clearEditor();
        await loadPublishedProjects();
      });
      actions.append(editButton, deleteButton);
      row.append(title, actions);
      list.append(row);
    });
  }

  async function loadReviews() {
    const { data, error } = await client.from("project_proposals").select("*").eq("status", "pending").order("created_at", { ascending: true });
    const list = document.querySelector("#review-list");
    list.replaceChildren();
    if (error) {
      list.textContent = "Não foi possível carregar as propostas.";
      return;
    }
    if (!data?.length) {
      list.textContent = "Não há propostas aguardando revisão.";
      return;
    }
    data.forEach((proposal) => {
      const item = document.createElement("article");
      item.className = "review-item";
      const title = document.createElement("h4");
      title.textContent = proposal.title;
      const school = document.createElement("p");
      school.textContent = schoolLabel(proposal.school_id);
      const summary = document.createElement("p");
      summary.textContent = proposal.summary;
      const body = document.createElement("p");
      body.textContent = proposal.body;
      
      const links = document.createElement("div");
      links.style.marginBottom = "10px";
      if (proposal.image_url) {
        const imgLink = document.createElement("a");
        imgLink.href = proposal.image_url;
        imgLink.target = "_blank";
        imgLink.textContent = "🖼️ Ver Imagem";
        imgLink.style.marginRight = "15px";
        links.append(imgLink);
      }
      if (proposal.code_url) {
        const codeLink = document.createElement("a");
        codeLink.href = proposal.code_url;
        codeLink.target = "_blank";
        codeLink.textContent = "💻 Ver Código";
        links.append(codeLink);
      }

      const actions = document.createElement("div");
      actions.className = "review-actions";
      [[true, "Aprovar"], [false, "Recusar"]].forEach(([approve, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = approve ? "button button-dark" : "button button-outline";
        button.textContent = label;
        button.addEventListener("click", async () => {
          button.disabled = true;
          const { error: reviewError } = await client.rpc("review_project_proposal", { p_proposal_id: proposal.id, p_approve: approve });
          if (reviewError) {
            setMessage(reviewError.message, true);
            button.disabled = false;
            return;
          }
          setMessage(approve ? "Projeto aprovado e publicado." : "Proposta recusada.");
          await loadReviews();
        });
        actions.append(button);
      });
      item.append(title, school, summary, body, links, actions);
      list.append(item);
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const { error } = await client.auth.signInWithPassword({ email: formData.get("email"), password: formData.get("password") });
    if (error) {
      notice.hidden = false;
      notice.textContent = "Não foi possível entrar. Confira o e-mail e a senha.";
      return;
    }
    await loadWorkspace();
  });

  document.querySelector("#signup-email").addEventListener("input", (event) => {
    const email = event.currentTarget.value.trim();
    if (!email) {
      signupRoleNotice.textContent = "Use um e-mail para ver o tipo de acesso que será solicitado.";
      return;
    }
    const isSchoolEmail = /@escola\.pr\.gov\.br$/i.test(email);
    signupRoleNotice.textContent = isSchoolEmail
      ? "Este domínio receberá perfil de aluno, sujeito à confirmação do e-mail."
      : "Este domínio receberá perfil de visitante, somente para visualizar o site.";
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const email = String(formData.get("email")).trim().toLowerCase();
    const password = String(formData.get("password"));
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) {
      notice.hidden = false;
      notice.textContent = "Não foi possível criar a conta. Confira o e-mail e tente novamente.";
      return;
    }
    if (data.session) {
      await loadWorkspace();
      return;
    }
    notice.hidden = false;
    notice.textContent = "Cadastro criado. Verifique seu e-mail para confirmar a conta; o acesso será liberado após a confirmação.";
    signupForm.reset();
    signupRoleNotice.textContent = "Use um e-mail para ver o tipo de acesso que será solicitado.";
  });

  proposalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const proposalId = document.querySelector("#proposal-id").value;
    
    const project = {
      school_id: document.querySelector("#project-school").value,
      title: document.querySelector("#project-title").value.trim(),
      summary: document.querySelector("#project-summary").value.trim(),
      body: document.querySelector("#project-body").value.trim(),
      image_url: document.querySelector("#project-image-url").value.trim() || null,
      code_url: document.querySelector("#project-code-url").value.trim() || null
    };

    let error;
    const publishedProjectId = document.querySelector("#published-project-id").value;
    if (currentRole === "admin" && publishedProjectId) {
      ({ error } = await client.from("projects").update(project).eq("id", publishedProjectId));
      if (!error) setMessage("Projeto atualizado e já visível no site.");
    } else if (currentRole === "admin") {
      ({ error } = await client.from("projects").insert({ ...project, author_id: currentUser.id }));
      if (!error) setMessage("Projeto publicado.");
    } else if (proposalId) {
      ({ error } = await client.from("project_proposals").update(project).eq("id", proposalId));
      if (!error) setMessage("Proposta atualizada e mantida em revisão.");
    } else {
      const targetProjectId = document.querySelector("#target-project-id").value || null;
      ({ error } = await client.from("project_proposals").insert({ ...project, author_id: currentUser.id, target_project_id: targetProjectId }));
      if (!error) setMessage("Enviado para revisão. O projeto só será publicado após aprovação.");
    }
    
    if (error) {
      setMessage(error.message, true);
      return;
    }
    clearEditor();
    await Promise.all([
      loadMyProjects(),
      loadMyProposals(),
      currentRole === "admin" ? loadReviews() : Promise.resolve(),
      currentRole === "admin" ? loadPublishedProjects() : Promise.resolve()
    ]);
  });

  document.querySelector("#cancel-edit-button").addEventListener("click", () => {
    clearEditor();
    setMessage("Edição cancelada.");
  });

  document.querySelector("#logout-button").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.reload();
  });

  client.auth.getSession().then(({ data }) => {
    if (data.session) loadWorkspace();
    else notice.textContent = "Entre com a conta criada pelo administrador.";
  });
})();
