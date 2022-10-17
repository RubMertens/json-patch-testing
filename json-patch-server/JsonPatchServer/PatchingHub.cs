using System.Dynamic;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace JsonPatchServer;


public class ProjectModel
{
    public Dictionary<string, Node> Nodes { get; set; } = new();
}

public class Node
{
    public string? Name { get; set; }
    public int? X { get; set; }
}

public class ModelService
{
    public ProjectModel Model { get; set; } = new();
}

public class ConfirmingJsonPatch
{
    public JsonPatchDocument<ProjectModel> PatchDocument { get; set; }
    public int ConfirmationCode { get; set; }
}
public class PatchingHub: Hub
{
    private readonly ILogger<PatchingHub> _logger;
    private readonly ModelService _modelService;


    public PatchingHub(ILogger<PatchingHub> logger, ModelService modelService)
    {
        _logger = logger;
        _modelService = modelService;
    }

    public override Task OnConnectedAsync()
    {
        _logger.LogInformation("Client {client} connected", Context.ConnectionId);
        Clients.Client(Context.ConnectionId).SendAsync("onInit", _modelService.Model);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client {client} disconnected", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    public async Task BroadcastChanges(ConfirmingJsonPatch confirmingPathDocument)
    {
        confirmingPathDocument.PatchDocument.ApplyTo(_modelService.Model);
        _logger.LogInformation("model changed to {model}", JsonConvert.SerializeObject(_modelService.Model, Formatting.Indented));
        await Clients.All.SendAsync("onChange", confirmingPathDocument);
    }
}