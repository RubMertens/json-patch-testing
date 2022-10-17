using JsonPatchServer;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRouting();
builder.Services.AddControllers(o => o.InputFormatters.Insert(0, MyJPIF.GetJsonPatchInputFormatter()));
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR().AddNewtonsoftJsonProtocol();
builder.Services.AddSingleton<ModelService>();
    


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors(o => o.AllowCredentials().WithOrigins("http://127.0.0.1:5173").AllowAnyHeader().AllowAnyMethod());
app.UseAuthorization();
app.UseRouting();
app.UseEndpoints(
    e =>
        e.MapHub<PatchingHub>("/connect")
);

app.Run();